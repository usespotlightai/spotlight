import { randomUUID } from 'node:crypto';

import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { DrizzleChangeStackRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.repository';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { aDispatch, outcomeOf, requestedByTask } from './support/runs';
import * as schema from './support/schema';
import { insertTask } from './support/tasks';
import { createTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
const TEAMMATE = randomUUID();
const ADMIN = randomUUID();
const BYSTANDER = randomUUID();
const OUTSIDER = randomUUID();
const TASK = randomUUID();
const RUN = randomUUID();
const STACK = randomUUID();
const QUESTION = 'c1.l1.q1';

const ofTeam = () => `/api/teams/${team.teamId.value}`;
const review = () => `${ofTeam()}/runs/${RUN}/review`;

const reading = (by: string) =>
  served(app).get(review()).set(TEST_USER_HEADER, by);

const commenting = (by: string) =>
  served(app)
    .post(`${review()}/comments`)
    .set(TEST_USER_HEADER, by)
    .send({ body: 'Why a queue?', path: 'queue.ts', side: 'new', line: 1 });

const editing = (by: string, commentId: string) =>
  served(app)
    .patch(`${review()}/comments/${commentId}`)
    .set(TEST_USER_HEADER, by)
    .send({ body: 'Changed' });

const deleting = (by: string, commentId: string) =>
  served(app)
    .delete(`${review()}/comments/${commentId}`)
    .set(TEST_USER_HEADER, by);

const submitting = (by: string) =>
  served(app)
    .post(review())
    .set(TEST_USER_HEADER, by)
    .send({ verdict: 'approve', body: '' });

const answering = (by: string) =>
  served(app)
    .post(
      `${ofTeam()}/runs/${RUN}/change-stacks/${STACK}/questions/${QUESTION}/answers`,
    )
    .set(TEST_USER_HEADER, by)
    .send({ reply: null });

const disputing = (by: string) =>
  served(app)
    .post(`${ofTeam()}/tasks/${TASK}/decisions/decision_1/disputes`)
    .set(TEST_USER_HEADER, by)
    .send({ path: 'queue.ts', reason: 'The queue is gone.' });

interface Comment {
  readonly id: string;
  readonly body: string;
}

const commentsOnReview = async (): Promise<Comment[]> =>
  ((await reading(TEAMMATE)).body as { comments: Comment[] }).comments;

const stackOfRun = (): ChangeStack =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of(STACK),
    runId: RunId.of(RUN),
    taskId: TaskId.of(TASK),
    teamOfRun: null,
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of(team.workspaceId.value),
    repository: null,
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
    now: new Date(),
  }).propose(
    [
      {
        kind: 'change',
        title: 'Drain the queue',
        intent: 'Drain instead of polling',
        layers: [
          {
            title: 'Drain',
            summary: 'Drains the queue',
            dependsOn: [],
            hunks: [{ hunk: HunkId.of('h1') }],
            notes: [{ path: 'queue.ts', note: 'Drains' }],
            questions: [
              {
                question: 'What happens to a message that fails?',
                answer: 'It goes back on the queue.',
                hunks: [HunkId.of('h1')],
              },
            ],
          },
        ],
      },
    ],
    new Date(),
  );

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `review-${randomUUID().slice(0, 8)}`,
  );
  const workspaceId = team.workspaceId.value;

  await db.insert(schema.user).values(
    [TEAMMATE, ADMIN, BYSTANDER, OUTSIDER].map((id, at) => ({
      id,
      name: ['Bea', 'Cy', 'Dee', 'Eve'][at],
      email: `${id}@example.com`,
    })),
  );
  await db.insert(schema.workspaceMember).values([
    { workspaceId, userId: TEAMMATE, role: 'member' },
    { workspaceId, userId: ADMIN, role: 'admin' },
    { workspaceId, userId: BYSTANDER, role: 'member' },
  ]);
  await db.insert(schema.teamMember).values({
    workspaceId,
    teamId: team.teamId.value,
    userId: TEAMMATE,
  });
  await insertTask(db, {
    id: TASK,
    branch: `feat/test-${TASK}`,
    openedFrom: 'person',
    workspaceId,
    stationId: team.stationId.value,
    title: 'Drain the queue',
    originStationId: team.stationId.value,
    createdById: team.owner.value,
  });
  await db.insert(schema.run).values({
    ...requestedByTask(TASK, { teamId: team.teamId.value }),
    id: RUN,
    workspaceId,
    harness: 'dev',
    state: 'completed',
    ...outcomeOf('completed'),
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'drain the queue',
      handover: { options: [], noteLimit: 0 },
      resume: {},
    },
    createdAt: new Date(),
    queuedAt: new Date(),
    startedAt: new Date(),
    endedAt: new Date(),
  });
  await db.insert(schema.dispatch).values(
    aDispatch({
      runId: RUN,
      workspaceId,
      teamId: team.teamId.value,
      taskId: TASK,
      stationId: team.stationId.value,
      endedAt: new Date(),
    }),
  );
  await app.get(DrizzleChangeStackRepository).add(stackOfRun());
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('a workspace member who is not on the team', () => {
  it('reads the review, the change stacks and the decisions of the team’s work', async () => {
    expect((await reading(BYSTANDER)).status).toBe(200);
    expect(
      (
        await served(app)
          .get(`${ofTeam()}/runs/${RUN}/change-stacks`)
          .set(TEST_USER_HEADER, BYSTANDER)
      ).status,
    ).toBe(200);
    expect(
      (
        await served(app)
          .get(`${ofTeam()}/tasks/${TASK}/decisions`)
          .set(TEST_USER_HEADER, BYSTANDER)
      ).status,
    ).toBe(200);
  });

  it('may not comment, and is told why', async () => {
    const answer = await commenting(BYSTANDER);

    expect(answer.status).toBe(403);
    expect((answer.body as { message: string }).message).toContain(
      'not a member of this team',
    );
    expect(await commentsOnReview()).toEqual([]);
  });

  it('may not answer a question of a change stack', async () => {
    expect((await answering(BYSTANDER)).status).toBe(403);
  });

  it('may not dispute a decision', async () => {
    expect((await disputing(BYSTANDER)).status).toBe(403);
  });

  it('may not edit or delete a teammate’s comment, which stays as it was', async () => {
    const drafted = await commenting(TEAMMATE);
    const { id } = drafted.body as Comment;

    expect(drafted.status).toBe(201);
    expect((await editing(BYSTANDER, id)).status).toBe(403);
    expect((await deleting(BYSTANDER, id)).status).toBe(403);
    expect(
      (await commentsOnReview()).find((each) => each.id === id)?.body,
    ).toBe('Why a queue?');
  });

  it('may not submit a review', async () => {
    expect((await submitting(BYSTANDER)).status).toBe(403);
    expect(
      ((await reading(TEAMMATE)).body as { reviews: unknown[] }).reviews,
    ).toEqual([]);
  });
});

describe('someone outside the workspace', () => {
  it('finds no review to read or comment on', async () => {
    expect((await reading(OUTSIDER)).status).toBe(404);
    expect((await commenting(OUTSIDER)).status).toBe(404);
    expect((await answering(OUTSIDER)).status).toBe(404);
  });
});

describe('a member of the team', () => {
  it('comments, answers and submits a review', async () => {
    const drafted = await commenting(TEAMMATE);
    const { id } = drafted.body as Comment;

    expect(drafted.status).toBe(201);
    expect((await editing(TEAMMATE, id)).status).toBe(204);
    expect((await answering(TEAMMATE)).status).toBe(201);
    expect((await disputing(TEAMMATE)).status).toBe(404);
    expect((await submitting(TEAMMATE)).status).toBe(201);
  });
});

describe('a workspace admin who is not on the team', () => {
  it('comments and deletes the comment', async () => {
    const drafted = await commenting(ADMIN);
    const { id } = drafted.body as Comment;

    expect(drafted.status).toBe(201);
    expect((await deleting(ADMIN, id)).status).toBe(204);
  });
});
