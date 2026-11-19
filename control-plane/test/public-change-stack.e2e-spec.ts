import { randomUUID } from 'node:crypto';

import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import { DrizzleChangeStackRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.repository';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served } from './support/app';
import * as schema from './support/schema';
import { createTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const OWNER = `owner-${randomUUID().slice(0, 8)}`;

const stackOf = (taskId: string, repository: string, minutes: number) =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of(randomUUID()),
    origin: StackOrigin.run(RunId.of(randomUUID())),
    taskId: TaskId.of(taskId),
    teamOfRun: null,
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of(team.workspaceId.value),
    owner: OWNER,
    repository,
    base: null,
    diff: Diff.of([
      {
        path: 'queue.ts',
        previousPath: null,
        status: 'modified',
        binary: false,
        hunks: [
          {
            id: HunkId.of('h1'),
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            patch: '@@ -1 +1 @@\n-poll\n+drain',
          },
        ],
      },
    ]),
    facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
    request: null,
    now: new Date(Date.UTC(2026, 0, 1, 0, minutes)),
  });

const taskOf = async (repositories: string[]): Promise<string> => {
  const taskId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
    branch: `feat/test-${taskId}`,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: team.stationId.value,
    title: 'Drain the queue',
    originStationId: team.stationId.value,
    createdById: team.owner.value,
  });
  for (const [minutes, repository] of repositories.entries()) {
    await app
      .get(DrizzleChangeStackRepository)
      .add(stackOf(taskId, repository, minutes));
  }

  return taskId;
};

const knownAs = async (
  name: string,
  visibility: 'public' | 'private',
  checkedAt = new Date(),
) => {
  await db
    .insert(schema.repositoryVisibility)
    .values({ owner: OWNER.toLowerCase(), name, visibility, checkedAt })
    .onConflictDoUpdate({
      target: [
        schema.repositoryVisibility.owner,
        schema.repositoryVisibility.name,
      ],
      set: { visibility, checkedAt },
    });
};

const reading = (taskId: string) =>
  served(app).get(`/api/public/tasks/${taskId}/change-stacks`);

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `public-${randomUUID().slice(0, 8)}`,
  );
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('the public change stack of a task', () => {
  it('serves anybody a stack whose repository is public, without private data', async () => {
    await knownAs('open', 'public');
    const taskId = await taskOf(['open']);

    const response = await reading(taskId);
    const { stacks } = response.body as { stacks: Record<string, unknown>[] };

    expect(response.status).toBe(200);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]?.repository).toBe(`${OWNER}/open`);
    expect(Object.keys(stacks[0] ?? {}).sort()).toEqual([
      'cohorts',
      'files',
      'id',
      'removed',
      'repository',
      'state',
    ]);
  });

  it('denies a stack when one of its repositories is private', async () => {
    await knownAs('open-too', 'public');
    await knownAs('secret', 'private');
    const taskId = await taskOf(['open-too', 'secret']);

    expect((await reading(taskId)).status).toBe(404);
  });

  it('denies a stack whose repository visibility is unknown', async () => {
    const taskId = await taskOf(['never-checked']);

    expect((await reading(taskId)).status).toBe(404);
  });

  it('denies a stack at once when its repository turns private', async () => {
    await knownAs('turning', 'public');
    const taskId = await taskOf(['turning']);

    expect((await reading(taskId)).status).toBe(200);

    await knownAs('turning', 'private');

    expect((await reading(taskId)).status).toBe(404);
  });

  it('denies a stack when its cached visibility is stale and GitHub cannot answer', async () => {
    const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await knownAs('stale', 'public', stale);
    const taskId = await taskOf(['stale']);

    expect((await reading(taskId)).status).toBe(404);
  });

  it('denies a task that does not exist', async () => {
    expect((await reading(randomUUID())).status).toBe(404);
  });
});
