import { randomUUID } from 'node:crypto';
import { WorkspaceAccess } from '@identity/application/services/workspace-access.service';
import { DrizzleIdentityResources } from '@identity/infrastructure/persistence/drizzle/readers/identity-resources.reader';
import { DrizzlePersonReader } from '@identity/infrastructure/persistence/drizzle/readers/person.reader';
import { DrizzleViewableWorkspaces } from '@identity/infrastructure/persistence/drizzle/readers/viewable-workspaces.reader';
import { DrizzleWorkspaceReader } from '@identity/infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleWorkspaceRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace.repository';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DrizzleRunnerReader } from '@runners/infrastructure/persistence/drizzle/readers/runner.reader';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ListInboxHandler } from '@work/application/queries/handlers/list-inbox.handler';
import { ListInboxQuery } from '@work/application/queries/list-inbox.query';
import { settling } from '@work/domain/services/setup-list';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { openTeam as opening } from './support/team';

const access = (db: DrizzleDatabase) =>
  new WorkspaceAccess(
    new DrizzleViewableWorkspaces(db),
    new DrizzleWorkspaceRepository(new DrizzleContext(db), {
      dispatch: async () => {},
    }),
    new DrizzleIdentityResources(new DrizzleContext(db)),
  );

const NOW = new Date('2026-01-02T03:04:05.000Z');

const DONE = {
  connectedToGitHub: true,
  hasHarness: true,
};

let held: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;

const openTeam = (slug: string) => opening(db, tasks, slug);

beforeAll(async () => {
  held = await openDatabase('setup');
  db = held.db;
  tasks = new DrizzleTaskRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await held?.close();
});

describe('the setup lists a team still has standing', () => {
  it('finds a team’s own', async () => {
    const { teamId, list } = await openTeam('acme');

    const standing = await tasks.settingUpFor(teamId);

    expect(standing?.id).toEqual(list.id);
    expect(standing?.notes.map((each) => each.form)).toEqual(['setup']);
  });

  it('finds nothing for a team that has none', async () => {
    await expect(
      tasks.settingUpFor(TeamId.of(randomUUID())),
    ).resolves.toBeNull();
  });

  it('finds every one still standing', async () => {
    const mine = await openTeam('borden');
    const theirs = await openTeam('cutter');

    const standing = await tasks.settingUp();

    expect(standing.map((each) => each.id.value)).toEqual(
      expect.arrayContaining([mine.list.id.value, theirs.list.id.value]),
    );
  });

  it('leaves a settled one out', async () => {
    const { teamId, list } = await openTeam('fallon');

    const saying = settling(list.notes, DONE, NOW);
    const gone = list.settled(saying as NonNullable<typeof saying>);

    expect(gone.finishedAt).toBeNull();
    await tasks.save(gone);

    await expect(tasks.settingUpFor(teamId)).resolves.toBeNull();
    expect(
      (await tasks.settingUp()).map((each) => each.id.value),
    ).not.toContain(list.id.value);
  });

  it('keeps to the workspace it is asked about', async () => {
    const mine = await openTeam('hendricks');
    const theirs = await openTeam('sarah');

    const standing = await tasks.settingUpIn(mine.workspaceId);

    expect(standing.map((each) => each.id.value)).toEqual([mine.list.id.value]);
    expect(standing.map((each) => each.id.value)).not.toContain(
      theirs.list.id.value,
    );
  });

  it('keeps one somebody answered', async () => {
    const { teamId, list } = await openTeam('root');

    await tasks.save(
      list.answered(NotePosition.of(0), {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Working on it.'),
        at: NOW,
        voice: Voice.station(),
      }),
    );

    await expect(tasks.settingUpFor(teamId)).resolves.not.toBeNull();
  });

  it('leaves a task that never held a list out', async () => {
    const { workspaceId, teamId, stationId, list } = await openTeam('angier');

    await db.insert(schema.task).values({
      id: randomUUID(),
      workspaceId: workspaceId.value,
      stationId: stationId.value,
      title: 'Something else',
      rank: 'i',
    });

    await expect(tasks.settingUpFor(teamId)).resolves.toMatchObject({
      id: list.id,
    });
  });
});

describe('the inbox item a setup list stands as', () => {
  const inbox = () =>
    new ListInboxHandler(
      new DrizzleInboxReader(
        db,
        access(db),
        new DrizzleWorkspaceReader(db),
        new DrizzlePersonReader(db),
      ),
    ).execute(new ListInboxQuery(waiting.slug, waiting.owner.value));

  let waiting: Awaited<ReturnType<typeof openTeam>>;

  beforeAll(async () => {
    waiting = await openTeam('nolan');
  });

  it('stands owed while a step is still to be taken', async () => {
    const [item] = (await inbox()) ?? [];

    expect(item?.title).toBe('Set up your team');
    expect(item?.resolved).toBe(false);
  });

  it('reads as resolved once the list has been settled', async () => {
    const saying = settling(waiting.list.notes, DONE, NOW);

    await tasks.save(
      waiting.list.settled(saying as NonNullable<typeof saying>),
    );

    const [item] = (await inbox()) ?? [];

    expect(item?.resolved).toBe(true);
    expect(item?.notes[item.notes.length - 1]?.body).toBe(
      'Everything on this list is done.',
    );
  });
});

describe('whether a workspace has a way in for runners to offer work', () => {
  const runners = () =>
    new DrizzleRunnerReader(db, {
      now: () => new Date(),
      sleep: async () => {},
    });

  const pooled = (workspaceId: WorkspaceId, mode: 'pull' | 'push') =>
    db.insert(schema.runnerPool).values({
      id: randomUUID(),
      workspaceId: workspaceId.value,
      key: `pool-${randomUUID().slice(0, 8)}`,
      ...(mode === 'pull'
        ? { tokenHash: randomUUID().replaceAll('-', '').repeat(2) }
        : {
            provisionUrl: 'https://provision.example.com/runs',
            provisionSecret: 'sealed',
          }),
    });

  const trusted = (workspaceId: WorkspaceId) =>
    db.insert(schema.runnerTrust).values({
      id: randomUUID(),
      workspaceId: workspaceId.value,
      key: `trust-${randomUUID().slice(0, 8)}`,
      issuer: 'https://oidc.example.com/cluster',
      subject: 'system:serviceaccount:spotlight:runner',
      audience: 'spotlight',
    });

  const ways: Record<string, (workspace: WorkspaceId) => Promise<unknown>> = {
    'a pull pool': (workspace) => pooled(workspace, 'pull'),
    'a push pool': (workspace) => pooled(workspace, 'push'),
    'a runner trust': (workspace) => trusted(workspace),
  };

  afterEach(async () => {
    await db.delete(schema.runnerPool);
    await db.delete(schema.runnerTrust);
  });

  it('finds none in a workspace with neither pool nor trust', async () => {
    await expect(
      runners().anyOffersWork(WorkspaceId.of(randomUUID())),
    ).resolves.toBe(false);
  });

  it.each(Object.keys(ways))('finds one through %s', async (way) => {
    const workspace = WorkspaceId.of(randomUUID());

    await ways[way]?.(workspace);

    await expect(runners().anyOffersWork(workspace)).resolves.toBe(true);
  });

  it('does not count a pool or trust in another workspace', async () => {
    const mine = WorkspaceId.of(randomUUID());
    const theirs = WorkspaceId.of(randomUUID());

    await pooled(theirs, 'pull');
    await trusted(theirs);

    await expect(runners().anyOffersWork(mine)).resolves.toBe(false);
  });
});
