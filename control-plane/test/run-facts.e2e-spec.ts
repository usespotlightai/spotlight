import type { ProjectRunFacts } from '@insights/application/services/project-run-facts.service';
import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { TaskChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import { runFilterOf } from '@insights/domain/services/run-filter';
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { MemoryReference } from '@insights/domain/value-objects/run-memories.vo';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { DrizzleInsightsReader } from '@insights/infrastructure/persistence/drizzle/readers/insights.reader';
import type { DrizzlePullRequestRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import type { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import type { DrizzleTaskChangeShapeRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-change-shape.repository';
import type { DrizzleTaskHumanActionsRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-human-actions.repository';
import {
  pullRequestFact,
  pullRequestRecord,
  runFact,
  runRecord,
  taskChangeShape,
  taskHumanAction,
  taskPullRequestFact,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { seenOf } from '@insights/pull-requests.fake-spec';
import type { Env } from '@platform/config/env.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DrizzleReading } from '@platform/persistence/drizzle/drizzle.reading';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import { projectedInsights } from './support/insights-facts';

const WORKSPACE = WorkspaceId.of('workspace_facts');
const ELSEWHERE = WorkspaceId.of('workspace_elsewhere');
const TEAM = TeamId.of('team_facts');
const NEXT_DOOR = TeamId.of('team_next_door');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const HOUR = 60 * 60_000;
const NOW = Date.now();
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR);

let database: TestDatabase;
let facts: ProjectRunFacts;
let records: DrizzleRunRecordRepository;
let humanActions: DrizzleTaskHumanActionsRepository;
let pullRequests: DrizzlePullRequestRecordRepository;
let shapes: DrizzleTaskChangeShapeRepository;

const ended = (
  runId: string,
  taskId: string,
  options: {
    workspaceId?: WorkspaceId;
    teamId?: TeamId;
    endedHoursAgo?: number;
  } = {},
): RunRecord =>
  RunRecord.empty(RunId.of(runId), options.workspaceId ?? WORKSPACE).recordEnd(
    RunEnd.of({
      location: RunLocation.of({
        teamId: options.teamId ?? TEAM,
        lineId: LineId.of('line_1'),
        stationId: StationId.of('station_1'),
        taskId: TaskId.of(taskId),
      }),
      fingerprint: 'a'.repeat(64),
      agentConfig: RunAgentConfig.of({
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
      visit: 1,
      asked: false,
    }),
  );

const withUsageRecorded = (record: RunRecord): RunRecord =>
  record.recordUsage(
    RunUsage.of({
      ms: 900_000,
      steps: 12,
      errors: 1,
      changedLines: 40,
      contextTokens: null,
      contextWindow: null,
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

const opening = (taskId: string, teamId: TeamId): TaskHumanActions =>
  TaskHumanActions.empty(TaskId.of(taskId), WORKSPACE).recordOpen(
    TaskOpening.of({
      teamId,
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
      by: UserId.of('user_ada'),
      at: at(3),
    }),
  );

const opened = (
  taskId: string,
  teamId: TeamId,
  pullRequest = PULL,
  workspaceId = WORKSPACE,
): PullRequestRecord =>
  PullRequestRecord.noted(workspaceId, pullRequest).assignOwner({
    taskId: TaskId.of(taskId),
    teamId,
    openedAt: at(2),
  });

const mergedOnGitHub = (record: PullRequestRecord): PullRequestRecord =>
  record.seenAs(
    seenOf({
      number: Number(record.pullRequest.value.split('/').pop()),
      openedAt: at(2),
      state: 'merged',
      closedAt: at(0.1),
      updatedAt: at(0.1),
      firstReviewAt: at(1),
    }),
  );

const merged = (
  taskId: string,
  teamId: TeamId,
  pullRequest = PULL,
): PullRequestRecord => mergedOnGitHub(opened(taskId, teamId, pullRequest));

const elsewhere = () => {
  const context = new DrizzleContext(database.db);

  return { context, ...projectedInsights(context) };
};

const erased = async <A extends { delete(): A }>(
  aggregates: ScopedRemoval<A>,
  scope: DeletionScope,
): Promise<void> => {
  for (const each of await aggregates.ofScope(scope, 1_000)) {
    await aggregates.save(each.delete());
  }
};

const released = async (
  records: DrizzlePullRequestRecordRepository,
  scope: DeletionScope,
): Promise<void> => {
  for (const each of await records.ofScope(scope, 1_000)) {
    const kept = each.erasing(scope);

    if (kept === null) {
      await records.save(each.delete());
    } else if (kept !== each) {
      await records.save(kept);
    }
  }
};

const pullRequestOf = (pullRequest = PULL) =>
  pullRequests.at(WORKSPACE, pullRequest) as Promise<PullRequestRecord>;

const whileLocked = async (
  lock: (first: ReturnType<typeof elsewhere>) => Promise<void>,
  meanwhile: () => Promise<void>,
): Promise<void> => {
  const first = elsewhere();
  let done = false;
  let waiting: Promise<void> = Promise.resolve();

  await first.context.inTransaction(async () => {
    await lock(first);
    waiting = meanwhile().finally(() => {
      done = true;
    });
    waiting.catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(done).toBe(false);
  });
  await waiting;
};

const factOf = async (runId: string) => {
  const [row] = await database.db
    .select()
    .from(runFact)
    .where(eq(runFact.runId, runId));

  return row ?? null;
};

const allFacts = () =>
  database.db.select().from(runFact).orderBy(asc(runFact.runId));

beforeAll(async () => {
  database = await openDatabase('run_facts');
  const projected = projectedInsights(new DrizzleContext(database.db));

  facts = projected.runFacts;
  records = projected.records;
  humanActions = projected.humanActions;
  pullRequests = projected.pullRequests;
  shapes = projected.shapes;
}, 60_000);

afterAll(async () => {
  await database?.close();
});

beforeEach(async () => {
  await database.db.delete(runRecord);
  await database.db.delete(taskHumanAction);
  await database.db.delete(pullRequestRecord);
  await database.db.delete(taskChangeShape);
  await database.db.delete(runFact);
  await database.db.delete(taskPullRequestFact);
  await database.db.delete(pullRequestFact);
});

describe('run facts', () => {
  it('stores no fact for a run that has not ended', async () => {
    await records.add(RunRecord.empty(RunId.of('run_open'), WORKSPACE));

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
      usageRecorded: false,
      cost: null,
    });

    const recorded = await records.of(RunId.of('run_1'));
    await records.save(
      withUsageRecorded(recorded as RunRecord).recordAction(
        HumanAction.of('accepted', at(0.5)),
      ),
    );

    expect(await factOf('run_1')).toMatchObject({
      usageRecorded: true,
      cost: 1.25,
      currency: 'USD',
      ms: 900_000,
      firstHumanAction: 'accepted',
      firstHumanActionAt: at(0.5),
    });
  });

  it('stores the memories a run was briefed with before it ended in its fact, and those it recalled after', async () => {
    const runId = RunId.of('run_briefed');
    await records.add(
      RunRecord.empty(runId, WORKSPACE, TaskId.of('task_b')).recordMemories(
        'briefed',
        [MemoryReference.of('mem_1')],
      ),
    );

    expect(await factOf('run_briefed')).toBeNull();

    const briefed = (await records.of(runId)) as RunRecord;
    await records.save(
      briefed.recordEnd(ended('run_briefed', 'task_b').end as RunEnd),
    );

    expect(await factOf('run_briefed')).toMatchObject({
      memories: { briefed: ['mem_1'], recalled: [] },
    });

    const finished = (await records.of(runId)) as RunRecord;
    await records.save(
      finished.recordMemories('recalled', [MemoryReference.of('mem_2')]),
    );

    expect(await factOf('run_briefed')).toMatchObject({
      memories: { briefed: ['mem_1'], recalled: ['mem_2'] },
    });
  });

  it('takes who opened the task and how it was delivered from their own records', async () => {
    await records.add(ended('run_1', 'task_1'));
    await records.add(ended('run_2', 'task_1'));

    await humanActions.add(
      TaskHumanActions.empty(TaskId.of('task_1'), WORKSPACE).recordOpen(
        TaskOpening.of({
          teamId: TEAM,
          lineId: LineId.of('line_1'),
          stationId: StationId.of('station_1'),
          by: UserId.of('user_ada'),
          at: at(3),
        }),
      ),
    );
    await pullRequests.add(opened('task_1', TEAM));

    expect(await factOf('run_2')).toMatchObject({
      openedById: 'user_ada',
      taskOpenedAt: at(3),
      pullRequest: PULL.value,
      pullRequestState: 'open',
    });

    await pullRequests.save(mergedOnGitHub(await pullRequestOf()));

    for (const runId of ['run_1', 'run_2']) {
      expect(await factOf(runId)).toMatchObject({
        pullRequestState: 'merged',
        pullRequestClosedAt: at(0.1),
      });
    }
  });

  it('takes no opener or pull request from another workspace’s records of the same task', async () => {
    await humanActions.add(
      TaskHumanActions.empty(TaskId.of('task_x'), ELSEWHERE).recordOpen(
        TaskOpening.of({
          teamId: TEAM,
          lineId: LineId.of('line_1'),
          stationId: StationId.of('station_1'),
          by: UserId.of('user_ada'),
          at: at(3),
        }),
      ),
    );
    await pullRequests.add(opened('task_x', TEAM, PULL, ELSEWHERE));
    await records.add(ended('run_x', 'task_x'));

    expect(await factOf('run_x')).toMatchObject({
      openedById: null,
      taskOpenedAt: null,
      pullRequest: null,
      pullRequestState: null,
    });
  });

  it('stores both changes when a run and its task’s pull request change at once', async () => {
    await records.add(ended('run_1', 'task_1'));
    await pullRequests.add(opened('task_1', TEAM));
    const pullRequestOfTask = await pullRequestOf();
    const second = elsewhere();

    await whileLocked(
      async (first) =>
        first.records.save(
          withUsageRecorded(
            (await first.records.of(RunId.of('run_1'))) as RunRecord,
          ),
        ),
      () => second.pullRequests.save(mergedOnGitHub(pullRequestOfTask)),
    );

    expect(await factOf('run_1')).toMatchObject({
      cost: 1.25,
      pullRequestState: 'merged',
    });
  });

  it('sees a task’s first run that ends while its pull request is merged', async () => {
    await pullRequests.add(opened('task_1', TEAM));
    const pullRequestOfTask = await pullRequestOf();
    const second = elsewhere();

    await whileLocked(
      (first) => first.records.add(ended('run_1', 'task_1')),
      () => second.pullRequests.save(mergedOnGitHub(pullRequestOfTask)),
    );

    expect(await factOf('run_1')).toMatchObject({ pullRequestState: 'merged' });
  });

  it('deletes a team’s runs, and the openings and pull requests of its tasks wherever their runs are', async () => {
    await records.add(ended('run_ours', 'task_ours'));
    await records.add(
      ended('run_shared', 'task_shared', { teamId: NEXT_DOOR }),
    );
    await records.add(
      ended('run_theirs', 'task_theirs', { teamId: NEXT_DOOR }),
    );
    for (const [taskId, teamId, number] of [
      ['task_ours', TEAM, 7],
      ['task_shared', TEAM, 8],
      ['task_theirs', NEXT_DOOR, 9],
    ] as const) {
      await humanActions.add(opening(taskId, teamId));
      await pullRequests.add(
        merged(
          taskId,
          teamId,
          PullRequestUrl.of(`https://github.com/acme/api/pull/${number}`),
        ),
      );
    }

    const team = DeletionScope.ofTeam(WORKSPACE, TEAM);

    await erased(records, team);
    await erased(humanActions, team);
    await released(pullRequests, team);

    expect(await factOf('run_ours')).toBeNull();
    expect(await factOf('run_shared')).toMatchObject({
      teamId: NEXT_DOOR.value,
      openedById: null,
      pullRequestState: null,
      pullRequest: null,
    });
    expect(await factOf('run_theirs')).toMatchObject({
      openedById: 'user_ada',
      pullRequestState: 'merged',
    });
  });

  it('stores no fact for a deleted team’s run when its pull request changes meanwhile', async () => {
    await records.add(ended('run_1', 'task_1'));
    await pullRequests.add(opened('task_1', TEAM));
    const pullRequestOfTask = await pullRequestOf();
    const second = elsewhere();

    await whileLocked(
      (first) => erased(first.records, DeletionScope.ofTeam(WORKSPACE, TEAM)),
      () => second.pullRequests.save(mergedOnGitHub(pullRequestOfTask)),
    );

    expect(await factOf('run_1')).toBeNull();
  });

  it('keeps a deleted pull request deleted when the task’s opening changes meanwhile', async () => {
    await records.add(ended('run_1', 'task_1', { teamId: NEXT_DOOR }));
    await pullRequests.add(merged('task_1', TEAM));
    const second = elsewhere();

    await whileLocked(
      (first) =>
        released(first.pullRequests, DeletionScope.ofTeam(WORKSPACE, TEAM)),
      () => second.humanActions.add(opening('task_1', NEXT_DOOR)),
    );

    expect(await factOf('run_1')).toMatchObject({
      openedById: 'user_ada',
      pullRequestState: null,
    });
  });

  it('deletes the facts of the runs it deletes', async () => {
    await records.add(ended('run_1', 'task_1'));
    await records.add(ended('run_2', 'task_2'));
    await records.add(ended('run_3', 'task_3', { workspaceId: ELSEWHERE }));

    await erased(records, DeletionScope.ofTask(WORKSPACE, TaskId.of('task_1')));
    expect((await allFacts()).map((each) => each.runId)).toEqual([
      'run_2',
      'run_3',
    ]);

    await erased(records, DeletionScope.ofWorkspace(WORKSPACE));
    expect((await allFacts()).map((each) => each.runId)).toEqual(['run_3']);
  });

  it('repairs facts that drifted from their runs, and only those', async () => {
    await records.add(ended('run_1', 'task_1'));
    await records.add(ended('run_2', 'task_2'));
    await records.add(ended('run_3', 'task_3'));
    await records.add(ended('run_old', 'task_4', { endedHoursAgo: 24 * 10 }));
    const healthy = await allFacts();

    await database.db
      .update(runFact)
      .set({ cost: 99 })
      .where(eq(runFact.runId, 'run_1'));
    await database.db.delete(runFact).where(eq(runFact.runId, 'run_2'));
    await database.db
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
    await database.db.insert(runRecord).values(
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
        visit: 1,
      })),
    );
    await records.add(ended('run_gone', 'task_gone'));
    await database.db.delete(runRecord).where(eq(runRecord.runId, 'run_gone'));

    const rebuilt = await facts.rebuild({
      kind: 'workspace',
      workspaceId: WORKSPACE,
    });

    expect(rebuilt).toBe(1_205);
    expect(await factOf('run_gone')).toBeNull();
    expect(await allFacts()).toHaveLength(1_205);
  });

  it('stores how the run ended as its rules say, the size of its change, and whether it ran its config', async () => {
    await records.add(
      withUsageRecorded(ended('run_1', 'task_1')).supersededByItsTask(at(0.5)),
    );
    await records.add(
      RunRecord.empty(RunId.of('run_2'), WORKSPACE).recordEnd(
        RunEnd.of({
          ...(ended('run_2', 'task_2').end as RunEnd),
          location: (ended('run_2', 'task_2').end as RunEnd).location,
          fingerprint: 'a'.repeat(64),
          agentConfig: (ended('run_2', 'task_2').end as RunEnd).agentConfig,
          startedAt: null,
          ending: 'cancelled',
        }),
      ),
    );

    expect(await factOf('run_1')).toMatchObject({
      endedAs: 'completed',
      ending: 'superseded',
      ran: true,
      ranAConfig: true,
      size: 'small',
    });
    expect(await factOf('run_2')).toMatchObject({
      endedAs: 'cancelled',
      ending: 'cancelled',
      ran: false,
      ranAConfig: false,
      size: null,
    });
  });

  it('follows a superseding, a pass and a dismissal received after the run ended', async () => {
    await records.add(ended('run_1', 'task_1'));
    const recorded = (await records.of(RunId.of('run_1'))) as RunRecord;

    await records.save(
      recorded
        .supersededByItsTask(at(0.5))
        .passTo(StationPass.of(StationId.of('station_2'), at(0.4)))
        .dismissed(Dismissal.of({ tool: 'merge', server: null, at: at(0.3) })),
    );

    expect(await factOf('run_1')).toMatchObject({
      ending: 'superseded',
      supersededAt: at(0.5),
      passedTo: 'station_2',
      dismissals: [{ tool: 'merge', server: null, at: at(0.3).toISOString() }],
    });
  });

  it('keeps the task’s pull request apart, open until GitHub merges it, with GitHub’s first review', async () => {
    await pullRequests.add(opened('task_1', TEAM));

    const [open] = await database.db.select().from(taskPullRequestFact);
    expect(open).toMatchObject({
      taskId: 'task_1',
      teamId: TEAM.value,
      state: 'open',
      openedAt: at(2),
      firstReviewAt: null,
      closedAt: null,
    });

    await pullRequests.save(mergedOnGitHub(await pullRequestOf()));

    const [closed] = await database.db.select().from(taskPullRequestFact);
    expect(closed).toMatchObject({
      state: 'merged',
      firstReviewAt: at(1),
      closedAt: at(0.1),
    });

    await released(
      pullRequests,
      DeletionScope.ofTask(WORKSPACE, TaskId.of('task_1')),
    );

    expect(await database.db.select().from(taskPullRequestFact)).toEqual([]);
  });

  it('takes the latest pull request a task opened as the task’s own', async () => {
    const later = PullRequestUrl.of('https://github.com/acme/api/pull/8');
    await records.add(ended('run_1', 'task_1'));
    await pullRequests.add(merged('task_1', TEAM));
    await pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, later).assignOwner({
        taskId: TaskId.of('task_1'),
        teamId: TEAM,
        openedAt: at(0.05),
      }),
    );

    expect(await factOf('run_1')).toMatchObject({
      pullRequest: later.value,
      pullRequestState: 'open',
    });
  });

  it('stores what kind of pull request it is, who made it, its review rounds and when it merged', async () => {
    const people = PullRequestUrl.of('https://github.com/acme/api/pull/8');
    await pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, people).seenAs(
        seenOf({
          number: 8,
          title: 'Bump lodash',
          reviewRounds: 3,
          state: 'merged',
          closedAt: at(0.2),
          updatedAt: at(0.2),
        }),
      ),
    );
    await pullRequests.add(
      opened('task_1', TEAM).seenAs(
        seenOf({ title: 'Something', branch: 'fix/login', reviewRounds: 1 }),
      ),
    );

    const factFor = async (url: PullRequestUrl) =>
      (
        await database.db
          .select()
          .from(pullRequestFact)
          .where(eq(pullRequestFact.pullRequest, url.value))
      )[0];

    expect(await factFor(people)).toMatchObject({
      type: 'chore',
      madeBy: 'people',
      rounds: '3+',
      mergedAt: at(0.2),
    });
    expect(await factFor(PULL)).toMatchObject({
      type: 'fix',
      madeBy: 'spotlight',
      rounds: '1',
      mergedAt: null,
    });

    await shapes.add(
      TaskChangeShape.create({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        shape: {
          changeTitles: ['Add uploads', 'Add retries'],
          changeIntents: ['', ''],
          at: at(0.1),
        },
      }),
    );

    expect(await factFor(PULL)).toMatchObject({ type: 'feature' });

    await released(
      pullRequests,
      DeletionScope.ofTask(WORKSPACE, TaskId.of('task_1')),
    );

    expect(await factFor(PULL)).toMatchObject({ madeBy: 'people' });
  });

  it('lists a failed run its task superseded as superseded, not among the failed runs', async () => {
    const failed = (runId: string, taskId: string) =>
      RunRecord.empty(RunId.of(runId), WORKSPACE).recordEnd(
        RunEnd.of({
          ...(ended(runId, taskId).end as RunEnd),
          location: (ended(runId, taskId).end as RunEnd).location,
          fingerprint: 'a'.repeat(64),
          agentConfig: (ended(runId, taskId).end as RunEnd).agentConfig,
          ending: 'failed',
        }),
      );
    await records.add(failed('run_failed', 'task_1'));
    await records.add(
      failed('run_superseded', 'task_2').supersededByItsTask(at(0.5)),
    );
    const reader = new DrizzleInsightsReader(
      new DrizzleReading(database.db, {
        DATABASE_READ_TIMEOUT_MS: 15_000,
      } as Env),
    );
    const window = { from: at(24), to: at(0) };
    const listed = (outcome: string) =>
      reader.runPage({
        window: { workspaceId: WORKSPACE, teamId: TEAM, ...window },
        filter: runFilterOf(
          {
            lineId: null,
            stationId: null,
            outcome,
            harness: null,
            model: { kind: 'any' },
            repository: { kind: 'any' },
            fingerprint: null,
            taskId: null,
            taskIds: null,
            personId: null,
            day: null,
            week: null,
            skillEnabled: null,
            skillUsed: null,
            server: null,
            serverFailed: null,
            failedAfter: null,
            dismissedTool: null,
            dismissedServer: { kind: 'any' },
            pullRequestState: null,
            humanAction: null,
            asked: false,
          },
          window,
        ),
        offset: 0,
        limit: 10,
      });

    expect(
      (await listed('failed')).runs.map((each) => [each.runId, each.ending]),
    ).toEqual([['run_failed', 'failed']]);
    expect(
      (await listed('superseded')).runs.map((each) => [
        each.runId,
        each.ending,
      ]),
    ).toEqual([['run_superseded', 'superseded']]);
  });
});
