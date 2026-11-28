import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TranslatedDomainError } from '@shared-kernel/application/errors/translated-domain-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { BlockTaskCommand } from '@work/application/commands/block-task.command';
import { BlockTaskHandler } from '@work/application/commands/handlers/block-task.handler';
import { ReleaseBlockedTasks } from '@work/application/events/handlers/release-blocked-tasks.handler';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskBlockingPort } from '@work/application/ports/task-blocking.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { SeenBlockers } from '@work/application/services/seen-blockers';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskCompleted } from '@work/domain/events/task-completed.event';
import { TaskRunAssigned } from '@work/domain/events/task-run-assigned.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleTaskBlocking } from '@work/infrastructure/persistence/drizzle/readers/task-blocking.reader';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

const NOW = new Date('2026-11-28T09:00:00.000Z');
const RANK = TaskRank.of('i');

let database: TestDatabase;
let context: DrizzleContext;
let tasks: DrizzleTaskRepository;
let blocking: DrizzleTaskBlocking;
let line: LineMap;
let owner: UserId;
const committed: DomainEvent[] = [];
const runsAsked: RunId[] = [];

const recording = {
  dispatch: async (events: readonly DomainEvent[]) =>
    context.afterCommit(() => committed.push(...events)),
};

const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const dispatch: TaskDispatching = {
  runIdFor: async () => {
    const run = RunId.of(randomUUID());

    runsAsked.push(run);

    return run;
  },
};

const placements: TaskPlacementsPort = { placementsAt: async () => [] };

const lines = (): LineMapsPort => ({
  find: async () => line,
  findByStation: async () => line,
  ofTeam: async () => [line],
  ofWorkspace: async () => [line],
  candidate: async () => {
    throw new Error('blocking reads no candidate line');
  },
});

const access = () => workAccessSeeing(() => true);

interface Gate {
  readonly reached: Promise<void>;
  readonly open: () => void;
  readonly pass: () => Promise<void>;
}

const gate = (): Gate => {
  let reach = (): void => {};
  let open = (): void => {};
  const reached = new Promise<void>((resolve) => {
    reach = resolve;
  });
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return {
    reached,
    open,
    pass: async () => {
      reach();
      await opened;
    },
  };
};

const blockedWith = (over: {
  readonly blockers?: Pick<TaskRepository, 'blockersAmong'>;
  readonly graph?: TaskBlockingPort;
}): BlockTaskHandler =>
  new BlockTaskHandler(
    tasks,
    access(),
    context,
    lines(),
    new SeenBlockers(over.blockers ?? tasks, lines(), access()),
    over.graph ?? blocking,
    clock,
  );

const block = (
  waiting: Task,
  blockers: readonly Task[],
  handler = blockedWith({}),
): Promise<void> =>
  handler.execute(
    new BlockTaskCommand(
      line.teamId.value,
      waiting.id.value,
      blockers.map((each) => each.id.value),
      owner.value,
    ),
  );

const inBacklog = async (title: string): Promise<Task> => {
  const added = Task.add({
    line,
    at: line.backlog.id,
    title: TaskTitle.of(title),
    rank: RANK,
    createdBy: owner,
    now: NOW,
    newId: () => randomUUID(),
  });

  await tasks.add(added);

  return found(added.id);
};

const found = async (id: TaskId): Promise<Task> => {
  const task = await tasks.find(id);

  if (!task) {
    throw new Error(`task ${id.value} is gone`);
  }

  return task;
};

const completing = (task: Task, beforeCommit?: Gate): Promise<void> =>
  context.inTransaction(async () => {
    const current = await found(task.id);

    await tasks.save(
      current.moveTo(
        line,
        line.completed.id,
        RANK,
        {
          line,
          body: TaskNoteBody.movedTo(line.completed.name),
          at: NOW,
          voice: Voice.person(owner),
        },
        { mover: owner },
      ),
    );
    await beforeCommit?.pass();
  });

const waitingLocks = async (): Promise<number> => {
  const result = await database.db.execute<{ waiting: number }>(sql`
    select count(*)::int as waiting
    from pg_locks
    join pg_stat_activity on pg_stat_activity.pid = pg_locks.pid
    where pg_stat_activity.datname = current_database()
      and not pg_locks.granted
  `);

  return result.rows[0]?.waiting ?? 0;
};

const someoneWaitsForALock = () =>
  eventually(async () => (await waitingLocks()) > 0, 10_000);

const release = (): ReleaseBlockedTasks =>
  new ReleaseBlockedTasks(tasks, lines(), placements, dispatch, context, clock);

const releasedFor = async (task: Task): Promise<void> => {
  for (const each of committed) {
    if (each instanceof TaskCompleted && each.taskId.equals(task.id)) {
      await release().onCompleted(each);
    }
  }
};

beforeAll(async () => {
  database = await openDatabase('task_blocking_races');
  context = new DrizzleContext(database.db);
  tasks = new DrizzleTaskRepository(context, recording);
  blocking = new DrizzleTaskBlocking(context);

  const team = await createTeam(
    database.db,
    tasks,
    `blocking-${randomUUID().slice(0, 8)}`,
  );
  owner = team.owner;
  line = deliveryLineOf({
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    harness: HarnessId.of('dev'),
    newId: () => randomUUID(),
  });

  await database.db.insert(schema.line).values({
    id: line.id.value,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: line.key.value,
    name: line.name.value,
  });
  await insertStations(
    database.db,
    line.stations.map((each) => ({
      id: each.id.value,
      workspaceId: team.workspaceId.value,
      lineId: line.id.value,
      key: each.key.value,
      name: each.name.value,
      position: each.position,
      kind: each.kind,
    })),
  );
}, 60_000);

afterAll(async () => {
  await database.close();
});

beforeEach(() => {
  committed.length = 0;
  runsAsked.length = 0;
});

describe('what blocks what, against Postgres (e2e)', () => {
  it('reads only the tasks the new blockers wait for, through any number of tasks', async () => {
    const first = await inBacklog('Add the table');
    const second = await inBacklog('Add the API');
    const third = await inBacklog('Show it on the web');
    const apart = await inBacklog('Unrelated');
    const apartBlocker = await inBacklog('Unrelated blocker');

    await block(second, [first]);
    await block(third, [second]);
    await block(apart, [apartBlocker]);

    const graph = await blocking.graphFrom(line.workspaceId, [third.id]);

    expect(graph.waitsFor(third.id, first.id)).toBe(true);
    expect(graph.waitsFor(apart.id, apartBlocker.id)).toBe(false);
    await expect(block(first, [third])).rejects.toThrow(TranslatedDomainError);
    expect((await found(first.id)).blockedBy).toEqual([]);
  });

  it('lets only one of two people who block two tasks by each other at once save it', async () => {
    const api = await inBacklog('Add the API');
    const web = await inBacklog('Show it on the web');
    const paused = gate();
    const slow = blockedWith({
      graph: {
        lockIn: (workspaceId) => blocking.lockIn(workspaceId),
        graphFrom: async (workspaceId, from) => {
          const graph = await blocking.graphFrom(workspaceId, from);

          await paused.pass();

          return graph;
        },
      },
    });

    const first = block(web, [api], slow);
    await paused.reached;
    const second = block(api, [web]).then(
      () => null,
      (error: unknown) => error,
    );

    await someoneWaitsForALock();
    paused.open();

    await first;
    expect(await second).toBeInstanceOf(TranslatedDomainError);
    expect((await found(web.id)).blockedBy).toEqual([api.id]);
    expect((await found(api.id)).blockedBy).toEqual([]);
  });

  it('starts a task blocked while its blocker completes at the same time, once the blocker is completed', async () => {
    const api = await inBacklog('Add the API');
    const web = await inBacklog('Show it on the web');
    const paused = gate();
    const slow = blockedWith({
      blockers: {
        blockersAmong: async (ids) => {
          const blockers = await tasks.blockersAmong(ids);

          await paused.pass();

          return blockers;
        },
      },
    });

    const blocked = block(web, [api], slow);
    await paused.reached;
    const completed = completing(api);

    await someoneWaitsForALock();
    paused.open();
    await Promise.all([blocked, completed]);
    await releasedFor(api);

    const started = await found(web.id);

    expect(started.blocked).toBe(false);
    expect(started.stationId).toEqual(line.entry?.id);
    expect(started.currentRunId).not.toBeNull();
  });

  it('does not block a task by a blocker that completes while it is named', async () => {
    const api = await inBacklog('Add the API');
    const web = await inBacklog('Show it on the web');
    const paused = gate();

    const completed = completing(api, paused);
    await paused.reached;
    const blocked = block(web, [api]);

    await someoneWaitsForALock();
    paused.open();
    await Promise.all([completed, blocked]);
    await releasedFor(api);

    const waiting = await found(web.id);

    expect(waiting.blocked).toBe(false);
    expect(waiting.stationId).toEqual(line.backlog.id);
    expect(waiting.currentRunId).toBeNull();
  });

  it('starts one run for a released task whose save first lost to another write', async () => {
    const api = await inBacklog('Add the API');
    const web = await inBacklog('Show it on the web');
    const elsewhere = new DrizzleContext(database.db);
    const other = new DrizzleTaskRepository(elsewhere, {
      dispatch: async () => {},
    });
    let raced = false;
    const racing = new DrizzleTaskRepository(context, recording);

    racing.find = async (id: TaskId) => {
      const read = await tasks.find(id);

      if (!raced && id.equals(web.id) && read) {
        raced = true;
        await elsewhere.inTransaction(() =>
          other.save(read.reorderTo(TaskRank.of('m'))),
        );
      }

      return read;
    };

    await block(web, [api]);
    await completing(api);

    for (const each of committed) {
      if (each instanceof TaskCompleted && each.taskId.equals(api.id)) {
        await new ReleaseBlockedTasks(
          racing,
          lines(),
          placements,
          dispatch,
          context,
          clock,
        ).onCompleted(each);
      }
    }

    const started = await found(web.id);
    const assigned = committed.flatMap((each) =>
      each instanceof TaskRunAssigned && each.taskId.equals(web.id)
        ? [each.runId]
        : [],
    );

    expect(raced).toBe(true);
    expect(runsAsked).toHaveLength(2);
    expect(assigned).toEqual([started.currentRunId]);
    expect(assigned).toEqual([runsAsked[1]]);
    expect(started.stationId).toEqual(line.entry?.id);
  });
});
