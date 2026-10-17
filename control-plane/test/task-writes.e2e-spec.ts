import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import { settling } from '@work/domain/services/setup-list';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const NOW = new Date('2026-01-02T03:04:05.000Z');

const DONE = {
  connectedToGitHub: true,
  hasHarness: true,
  configured: true,
};

let database: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;

beforeAll(async () => {
  database = await openDatabase('task_writes');
  db = database.db;
  tasks = new DrizzleTaskRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const withCurrentRun = (task: Task, runId: RunId): Task =>
  Task.rehydrate({ ...task, currentRunId: runId });

describe('writing a task somebody else has written', () => {
  const opened = async () => {
    const { list } = await openTeam(db, tasks, `nolan-${randomUUID()}`);
    const id = list.id;

    const one = await tasks.find(id);
    const other = await tasks.find(id);

    if (!one || !other) {
      throw new Error('the task that was just added could not be read back');
    }

    return { one, other };
  };

  const settled = (task: NonNullable<Awaited<ReturnType<typeof tasks.find>>>) =>
    task.settled({
      station: StationName.of('Backlog'),
      body: TaskNoteBody.of('Everything on this list is done.'),
      at: NOW,
      voice: Voice.station(),
    });

  it('takes the first of them', async () => {
    const { one } = await opened();

    await expect(tasks.save(settled(one))).resolves.toBeUndefined();
  });

  it('refuses the second, rather than laying it over the first', async () => {
    const { one, other } = await opened();

    await tasks.save(withCurrentRun(one, RunId.of(randomUUID())));

    await expect(tasks.save(settled(other))).rejects.toBeInstanceOf(
      TaskVersionConflictError,
    );
  });

  it('leaves what the first writer put there', async () => {
    const { one, other } = await opened();
    const runId = RunId.of(randomUUID());

    await tasks.save(withCurrentRun(one, runId));
    await tasks.save(settled(other)).catch(() => {});

    const read = await tasks.find(one.id);

    expect(read?.currentRunId?.value).toBe(runId.value);
  });

  it('takes the same change once it is read again', async () => {
    const { one, other } = await opened();

    await tasks.save(withCurrentRun(one, RunId.of(randomUUID())));
    await tasks.save(settled(other)).catch(() => {});

    const again = await tasks.find(one.id);
    const saying = settling(again?.notes ?? [], DONE, NOW);

    await expect(
      tasks.save(
        (again as NonNullable<typeof again>).settled(
          saying as NonNullable<typeof saying>,
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it('refuses a second write from the same reading', async () => {
    const { one } = await opened();

    await tasks.save(settled(one));

    await expect(
      tasks.save(withCurrentRun(one, RunId.of(randomUUID()))),
    ).rejects.toBeInstanceOf(TaskVersionConflictError);
  });
});

describe('a person moving a task by hand', () => {
  const LINE = randomUUID();
  const BACKLOG = randomUUID();
  const BUILD = randomUUID();
  const SHIP = randomUUID();

  let app: INestApplication;
  let team: Awaited<ReturnType<typeof openTeam>>;

  beforeAll(async () => {
    app = await openApp();
    const servedDb = app.get<DrizzleDatabase>(DRIZZLE);
    team = await openTeam(
      servedDb,
      app.get(DrizzleTaskRepository),
      `movers-${randomUUID().slice(0, 8)}`,
    );

    await servedDb.insert(schema.line).values({
      id: LINE,
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      key: 'delivery',
      name: 'Delivery',
    });
    await servedDb.insert(schema.station).values([
      {
        id: BACKLOG,
        lineId: LINE,
        key: 'backlog',
        name: 'Backlog',
        position: 0,
        kind: 'backlog',
      },
      {
        id: BUILD,
        lineId: LINE,
        key: 'build',
        name: 'Build',
        position: 1,
        kind: 'work',
      },
      {
        id: SHIP,
        lineId: LINE,
        key: 'ship',
        name: 'Ship',
        position: 2,
        kind: 'work',
      },
      {
        id: randomUUID(),
        lineId: LINE,
        key: 'completed',
        name: 'Completed',
        position: 3,
        kind: 'completed',
      },
    ]);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const standingAt = async (stationId: string) => {
    const id = randomUUID();

    await app.get<DrizzleDatabase>(DRIZZLE).insert(schema.task).values({
      id,
      openedFrom: 'person',
      workspaceId: team.workspaceId.value,
      stationId,
      title: 'Drain the queue',
      raisedAtStationId: stationId,
      raisedById: team.owner.value,
      assigneeId: team.owner.value,
    });

    return id;
  };

  const moving = (taskId: string, stationId: string) =>
    served(app)
      .post(
        `/api/teams/${team.teamId.value}/lines/${LINE}/tasks/${taskId}/move`,
      )
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ stationId, revision: 0 });

  it('refuses a move from one work station to another, saying why', async () => {
    const taskId = await standingAt(BUILD);

    const refused = await moving(taskId, SHIP).expect(422);

    expect(refused.body.message).toContain('from Build to Ship');
    expect(
      (await app.get(DrizzleTaskRepository).find(TaskId.of(taskId)))?.stationId
        .value,
    ).toBe(BUILD);
  });

  it('parks work from a work station back in the backlog', async () => {
    const taskId = await standingAt(BUILD);

    const parked = await moving(taskId, BACKLOG).expect(200);

    expect(parked.body.stationId).toBe(BACKLOG);
  });
});
