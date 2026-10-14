import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import { TaskOpening } from '@outcomes/domain/value-objects/task-opening.vo';
import { DrizzleRunFactProjection } from '@outcomes/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { DrizzleRunRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleTaskDeliveryRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-delivery.repository';
import { DrizzleTaskTouchesRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-touches.repository';
import {
  runFact,
  runRecord,
  taskDelivery,
  taskTouches,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

const WORKSPACE = WorkspaceId.of('workspace_facts');
const ELSEWHERE = WorkspaceId.of('workspace_elsewhere');
const TEAM = TeamId.of('team_facts');
const NEXT_DOOR = TeamId.of('team_next_door');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const HOUR = 60 * 60_000;
const NOW = Date.now();
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR);

let held: TestDatabase;
let facts: DrizzleRunFactProjection;
let records: DrizzleRunRecordRepository;
let touches: DrizzleTaskTouchesRepository;
let deliveries: DrizzleTaskDeliveryRepository;

const ended = (
  runId: string,
  taskId: string,
  options: {
    workspaceId?: WorkspaceId;
    teamId?: TeamId;
    endedHoursAgo?: number;
  } = {},
): RunRecord =>
  RunRecord.heardOf(RunId.of(runId), options.workspaceId ?? WORKSPACE).ended(
    RunEnd.of({
      place: RunPlace.of({
        teamId: options.teamId ?? TEAM,
        lineId: 'line_1',
        stationId: 'station_1',
        taskId: TaskId.of(taskId),
      }),
      fingerprint: 'a'.repeat(64),
      setup: RunSetup.of({
        harness: 'claude-code',
        model: 'opus',
        effort: null,
        profileKey: null,
        repositories: ['acme/api'],
        skills: ['grafana'],
      }),
      queuedAt: at((options.endedHoursAgo ?? 1) + 0.5),
      startedAt: at((options.endedHoursAgo ?? 1) + 0.25),
      endedAt: at(options.endedHoursAgo ?? 1),
      ending: 'completed',
      failure: null,
      round: 1,
      asked: false,
    }),
  );

const digested = (record: RunRecord): RunRecord =>
  record.digested(
    RunCost.of({
      ms: 900_000,
      steps: 12,
      faults: 1,
      changedLines: 40,
      used: null,
      size: null,
      amount: 1.25,
      currency: 'USD',
      tokens: {
        input: 1000,
        output: 200,
        cacheRead: null,
        cacheWrite: null,
      },
    }),
    RunTools.NONE,
  );

const opening = (taskId: string, teamId: TeamId): TaskTouches =>
  TaskTouches.heardOf(TaskId.of(taskId), WORKSPACE).opened(
    TaskOpening.of({
      teamId,
      lineId: 'line_1',
      stationId: 'station_1',
      by: UserId.of('user_ada'),
      at: at(3),
    }),
  );

const merged = (taskId: string, teamId: TeamId): TaskDelivery =>
  TaskDelivery.opened({
    taskId: TaskId.of(taskId),
    workspaceId: WORKSPACE,
    teamId,
    pullRequest: PULL,
    at: at(2),
  }).closed({ pullRequest: PULL, merged: true, at: at(0.1) });

const elsewhere = () => {
  const context = new DrizzleContext(held.db);
  const quiet = {
    dispatch: async () => {},
  } as unknown as DomainEventDispatcher;
  const projection = new DrizzleRunFactProjection(context);

  return {
    context,
    records: new DrizzleRunRecordRepository(context, projection, quiet),
    touches: new DrizzleTaskTouchesRepository(context, projection),
    deliveries: new DrizzleTaskDeliveryRepository(context, projection, quiet),
  };
};

const whileHeld = async (
  held: (first: ReturnType<typeof elsewhere>) => Promise<void>,
  meanwhile: () => Promise<void>,
): Promise<void> => {
  const first = elsewhere();
  let settled = false;
  let waiting: Promise<void> = Promise.resolve();

  await first.context.run(async () => {
    await held(first);
    waiting = meanwhile().finally(() => {
      settled = true;
    });
    waiting.catch(() => {});
    await new Promise((settle) => setTimeout(settle, 300));
    expect(settled).toBe(false);
  });
  await waiting;
};

const factOf = async (runId: string) => {
  const [row] = await held.db
    .select()
    .from(runFact)
    .where(eq(runFact.runId, runId));

  return row ?? null;
};

const allFacts = () =>
  held.db.select().from(runFact).orderBy(asc(runFact.runId));

beforeAll(async () => {
  held = await openDatabase('run_facts');
  const context = new DrizzleContext(held.db);
  const quiet = {
    dispatch: async () => {},
  } as unknown as DomainEventDispatcher;

  facts = new DrizzleRunFactProjection(context);
  records = new DrizzleRunRecordRepository(context, facts, quiet);
  touches = new DrizzleTaskTouchesRepository(context, facts);
  deliveries = new DrizzleTaskDeliveryRepository(context, facts, quiet);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

beforeEach(async () => {
  await held.db.delete(runRecord);
  await held.db.delete(taskTouches);
  await held.db.delete(taskDelivery);
  await held.db.delete(runFact);
});

describe('run facts', () => {
  it('keeps no fact for a run that has not ended', async () => {
    await records.add(RunRecord.heardOf(RunId.of('run_open'), WORKSPACE));

    expect(await factOf('run_open')).toBeNull();
  });

  it('writes a fact when a run ends, and follows every later change', async () => {
    await records.add(ended('run_1', 'task_1'));

    expect(await factOf('run_1')).toMatchObject({
      workspaceId: WORKSPACE.value,
      teamId: TEAM.value,
      stationId: 'station_1',
      ending: 'completed',
      ran: true,
      beganAt: at(1.25),
      digested: false,
      cost: null,
    });

    const held1 = await records.of(RunId.of('run_1'));
    await records.save(
      digested(held1 as RunRecord).actedOn(NextAct.of('closed', at(0.5))),
    );

    expect(await factOf('run_1')).toMatchObject({
      digested: true,
      cost: 1.25,
      currency: 'USD',
      ms: 900_000,
      nextAct: 'closed',
      nextAt: at(0.5),
    });
  });

  it('takes who opened the task and how it was delivered from their own records', async () => {
    await records.add(ended('run_1', 'task_1'));
    await records.add(ended('run_2', 'task_1'));

    await touches.add(
      TaskTouches.heardOf(TaskId.of('task_1'), WORKSPACE).opened(
        TaskOpening.of({
          teamId: TEAM,
          lineId: 'line_1',
          stationId: 'station_1',
          by: UserId.of('user_ada'),
          at: at(3),
        }),
      ),
    );
    const opened = TaskDelivery.opened({
      taskId: TaskId.of('task_1'),
      workspaceId: WORKSPACE,
      teamId: TEAM,
      pullRequest: PULL,
      at: at(2),
    });
    await deliveries.add(opened);

    expect(await factOf('run_2')).toMatchObject({
      openedBy: 'user_ada',
      taskOpenedAt: at(3),
      pullRequest: PULL.value,
      deliveryState: 'open',
    });

    const delivery = await deliveries.forTask(TaskId.of('task_1'));
    await deliveries.save(
      (delivery as TaskDelivery).closed({
        pullRequest: PULL,
        merged: true,
        at: at(0.1),
      }),
    );

    for (const runId of ['run_1', 'run_2']) {
      expect(await factOf(runId)).toMatchObject({
        deliveryState: 'merged',
        deliveryClosedAt: at(0.1),
      });
    }
  });

  it('keeps both changes when a run and its task’s delivery change at once', async () => {
    await records.add(ended('run_1', 'task_1'));
    await deliveries.add(
      TaskDelivery.opened({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest: PULL,
        at: at(2),
      }),
    );
    const delivery = (await deliveries.forTask(
      TaskId.of('task_1'),
    )) as TaskDelivery;
    const second = elsewhere();

    await whileHeld(
      async (first) =>
        first.records.save(
          digested((await first.records.of(RunId.of('run_1'))) as RunRecord),
        ),
      () =>
        second.deliveries.save(
          delivery.closed({ pullRequest: PULL, merged: true, at: at(0.1) }),
        ),
    );

    expect(await factOf('run_1')).toMatchObject({
      cost: 1.25,
      deliveryState: 'merged',
    });
  });

  it('sees a task’s first run that ends while its delivery is merged', async () => {
    await deliveries.add(
      TaskDelivery.opened({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest: PULL,
        at: at(2),
      }),
    );
    const delivery = (await deliveries.forTask(
      TaskId.of('task_1'),
    )) as TaskDelivery;
    const second = elsewhere();

    await whileHeld(
      (first) => first.records.add(ended('run_1', 'task_1')),
      () =>
        second.deliveries.save(
          delivery.closed({ pullRequest: PULL, merged: true, at: at(0.1) }),
        ),
    );

    expect(await factOf('run_1')).toMatchObject({ deliveryState: 'merged' });
  });

  it('forgets a team’s runs, and the openings and deliveries of its tasks wherever their runs are', async () => {
    await records.add(ended('run_ours', 'task_ours'));
    await records.add(
      ended('run_shared', 'task_shared', { teamId: NEXT_DOOR }),
    );
    await records.add(
      ended('run_theirs', 'task_theirs', { teamId: NEXT_DOOR }),
    );
    for (const [taskId, teamId] of [
      ['task_ours', TEAM],
      ['task_shared', TEAM],
      ['task_theirs', NEXT_DOOR],
    ] as const) {
      await touches.add(opening(taskId, teamId));
      await deliveries.add(merged(taskId, teamId));
    }

    await records.removeForTeam(WORKSPACE, TEAM);
    await touches.removeForTeam(WORKSPACE, TEAM);
    await deliveries.removeForTeam(WORKSPACE, TEAM);

    expect(await factOf('run_ours')).toBeNull();
    expect(await factOf('run_shared')).toMatchObject({
      teamId: NEXT_DOOR.value,
      openedBy: null,
      deliveryState: null,
      pullRequest: null,
    });
    expect(await factOf('run_theirs')).toMatchObject({
      openedBy: 'user_ada',
      deliveryState: 'merged',
    });
  });

  it('keeps no fact for a disbanded team’s run when its delivery changes meanwhile', async () => {
    await records.add(ended('run_1', 'task_1'));
    await deliveries.add(
      TaskDelivery.opened({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest: PULL,
        at: at(2),
      }),
    );
    const delivery = (await deliveries.forTask(
      TaskId.of('task_1'),
    )) as TaskDelivery;
    const second = elsewhere();

    await whileHeld(
      (first) => first.records.removeForTeam(WORKSPACE, TEAM),
      () =>
        second.deliveries.save(
          delivery.closed({ pullRequest: PULL, merged: true, at: at(0.1) }),
        ),
    );

    expect(await factOf('run_1')).toBeNull();
  });

  it('keeps a forgotten delivery forgotten when the task’s opening changes meanwhile', async () => {
    await records.add(ended('run_1', 'task_1', { teamId: NEXT_DOOR }));
    await deliveries.add(merged('task_1', TEAM));
    const second = elsewhere();

    await whileHeld(
      (first) => first.deliveries.removeForTeam(WORKSPACE, TEAM),
      () => second.touches.add(opening('task_1', NEXT_DOOR)),
    );

    expect(await factOf('run_1')).toMatchObject({
      openedBy: 'user_ada',
      deliveryState: null,
    });
  });

  it('drops the facts of the runs it forgets', async () => {
    await records.add(ended('run_1', 'task_1'));
    await records.add(ended('run_2', 'task_2'));
    await records.add(ended('run_3', 'task_3', { workspaceId: ELSEWHERE }));

    await records.removeForTask(TaskId.of('task_1'));
    expect((await allFacts()).map((each) => each.runId)).toEqual([
      'run_2',
      'run_3',
    ]);

    await records.removeForWorkspace(WORKSPACE);
    expect((await allFacts()).map((each) => each.runId)).toEqual(['run_3']);
  });

  it('repairs facts that drifted from their runs, and only those', async () => {
    await records.add(ended('run_1', 'task_1'));
    await records.add(ended('run_2', 'task_2'));
    await records.add(ended('run_3', 'task_3'));
    await records.add(ended('run_old', 'task_4', { endedHoursAgo: 24 * 10 }));
    const healthy = await allFacts();

    await held.db
      .update(runFact)
      .set({ cost: 99 })
      .where(eq(runFact.runId, 'run_1'));
    await held.db.delete(runFact).where(eq(runFact.runId, 'run_2'));
    await held.db
      .update(runFact)
      .set({ cost: 99 })
      .where(eq(runFact.runId, 'run_old'));

    const drift = await facts.repairEndedSince(at(24 * 3));

    expect(drift.checked).toBe(3);
    expect([...drift.repaired].sort()).toEqual(['run_1', 'run_2']);
    expect(
      (await allFacts()).filter((each) => each.runId !== 'run_old'),
    ).toEqual(healthy.filter((each) => each.runId !== 'run_old'));
    expect((await factOf('run_old'))?.cost).toBe(99);
  });

  it('finds nothing to repair when every fact matches its run', async () => {
    await records.add(ended('run_1', 'task_1'));

    expect(await facts.repairEndedSince(at(24 * 3))).toEqual({
      checked: 1,
      repaired: [],
    });
  });

  it('rebuilds a workspace from its runs, in chunks', async () => {
    await held.db.insert(runRecord).values(
      Array.from({ length: 1_205 }, (_, index) => ({
        runId: `run_${String(index).padStart(5, '0')}`,
        workspaceId: WORKSPACE.value,
        teamId: TEAM.value,
        lineId: 'line_1',
        stationId: 'station_1',
        taskId: `task_${index}`,
        harness: 'claude-code',
        repositories: [],
        skills: [],
        endedAt: at(1),
        ending: 'completed' as const,
        round: 1,
      })),
    );
    await records.add(ended('run_gone', 'task_gone'));
    await held.db.delete(runRecord).where(eq(runRecord.runId, 'run_gone'));

    const rebuilt = await facts.rebuild({
      kind: 'workspace',
      workspaceId: WORKSPACE.value,
    });

    expect(rebuilt).toBe(1_205);
    expect(await factOf('run_gone')).toBeNull();
    expect(await allFacts()).toHaveLength(1_205);
  });
});
