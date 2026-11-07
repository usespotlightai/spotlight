import { StationAlertStatesInMemory } from '@insights/alerts.fake-spec';
import { chatsInMemory } from '@insights/application/ports/chats.fake-spec';
import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import type { EndedRun } from '@insights/application/ports/work.port';
import { AlertInbox } from '@insights/application/services/alert-inbox.service';
import { DeleteInsights } from '@insights/application/services/delete-insights.service';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { GradeInboxRequests } from '@insights/application/services/grade-inbox-requests.service';
import { RecordChangeChecks } from '@insights/application/services/record-change-checks.service';
import { RecordChangeShape } from '@insights/application/services/record-change-shape.service';
import { RecordChat } from '@insights/application/services/record-chat.service';
import { RecordHumanAction } from '@insights/application/services/record-human-action.service';
import { RecordJudgeScore } from '@insights/application/services/record-judge-score.service';
import { RecordPullRequests } from '@insights/application/services/record-pull-requests.service';
import { RecordRunEnding } from '@insights/application/services/record-run-ending.service';
import { RecordRunMemories } from '@insights/application/services/record-run-memories.service';
import { RecordRunUsageSummary } from '@insights/application/services/record-run-usage-summary.service';
import { RecordStationPass } from '@insights/application/services/record-station-pass.service';
import { RecordSupersededRun } from '@insights/application/services/record-superseded-run.service';
import { RecordTaskFailure } from '@insights/application/services/record-task-failure.service';
import { RecordTaskHumanAction } from '@insights/application/services/record-task-human-action.service';
import { RequestJudging } from '@insights/application/services/request-judging.service';
import { WatchStations } from '@insights/application/services/watch-stations.service';
import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { RunJudged } from '@insights/domain/events/run-judged.event';
import { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import {
  TaskFailuresInMemory,
  TaskHumanActionsInMemory,
} from '@insights/insights.fake-spec';
import {
  JudgingsInMemory,
  judgeScore,
  queuedJudging,
  RUBRIC_VERSION,
  reasonOf,
  ScoresInMemory,
} from '@insights/judging.fake-spec';
import { insightsSubscribers } from '@insights/presentation/events/insights.subscribers';
import {
  PullRequestRecordsInMemory,
  TaskChangeShapesInMemory,
} from '@insights/pull-requests.fake-spec';
import {
  endedRecord,
  FIRST_CONFIG,
  inTransaction,
  RunRecordsInMemory,
  SET_UP,
  StationFactsInMemory,
} from '@insights/runs.fake-spec';
import { CHANGE_CHECKED } from '@shared-kernel/application/integration-events/change-checked.integration-event';
import { CHANGE_STACK_READY } from '@shared-kernel/application/integration-events/change-stack-ready.integration-event';
import { CHAT_STARTED } from '@shared-kernel/application/integration-events/chat-started.integration-event';
import { LINE_CHANGED } from '@shared-kernel/application/integration-events/line-changed.integration-event';
import { MEMORIES_USED } from '@shared-kernel/application/integration-events/memories-used.integration-event';
import { PULL_REQUEST_OPENED } from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import { PULL_REQUEST_PURGED } from '@shared-kernel/application/integration-events/pull-request-purged.integration-event';
import { PULL_REQUEST_REVIEW_TAKEN } from '@shared-kernel/application/integration-events/pull-request-review-taken.integration-event';
import { PULL_REQUEST_UPDATED } from '@shared-kernel/application/integration-events/pull-request-updated.integration-event';
import { RUN_ENDED } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { RUN_SUPERSEDED } from '@shared-kernel/application/integration-events/run-superseded.integration-event';
import { RUN_USAGE_RECORDED } from '@shared-kernel/application/integration-events/run-usage-recorded.integration-event';
import { TASK_ACTED_ON } from '@shared-kernel/application/integration-events/task-acted-on.integration-event';
import { TASK_ASKED } from '@shared-kernel/application/integration-events/task-asked.integration-event';
import { TASK_DELETED } from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import { TASK_FAILED } from '@shared-kernel/application/integration-events/task-failed.integration-event';
import { TASK_OPENED } from '@shared-kernel/application/integration-events/task-opened.integration-event';
import { TASK_PASSED } from '@shared-kernel/application/integration-events/task-passed.integration-event';
import { TEAM_DELETED } from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import { WORKSPACE_DELETED } from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const PULL = 'https://github.com/acme/api/pull/3';

const ENDED: EndedRun = {
  runId: 'run_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
  taskId: 'task_1',
  fingerprint: FIRST_CONFIG,
  visit: 1,
  ...SET_UP,
  endedAt: new Date('2026-09-30T10:00:00.000Z'),
};

const WORK = {
  unfinishedRuns: async () => [],
  traced: async () => ({ tasks: [], stations: [], outputs: new Map() }),
  taskRunOf: async (runId: string) =>
    runId === ENDED.runId
      ? { runId, taskId: ENDED.taskId, teamId: ENDED.teamId }
      : null,
  endedRun: async (runId: string) => (runId === ENDED.runId ? ENDED : null),
  configsInOrder: async () => [],
};

const CLOCK = {
  now: () => new Date('2026-09-30T10:05:00.000Z'),
  sleep: async () => {},
};

const subscribed = (alerts: readonly AlertRule[] | null = null) => {
  const records = new RunRecordsInMemory();
  const alertStates = new StationAlertStatesInMemory();
  const alerted: string[] = [];
  let alertsNow = alerts;
  const lines = {
    teamRepositories: async () => [],
    alertsAt: async () => alertsNow,
  };
  const judgings = new JudgingsInMemory();
  const scores = new ScoresInMemory();
  const humanActions = new TaskHumanActionsInMemory();
  const failures = new TaskFailuresInMemory();
  const chats = chatsInMemory();
  const pullRequests = new PullRequestRecordsInMemory();
  const shapes = new TaskChangeShapesInMemory();
  const deletions = deletionsInMemory();
  const asked: string[] = [];
  let next = 0;
  const subscribers = insightsSubscribers({
    ending: new RecordRunEnding(
      WORK,
      records,
      new FactRecorder(deletions),
      inTransaction,
      {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    ),
    superseding: new RecordSupersededRun(
      records,
      new FactRecorder(deletions),
      inTransaction,
    ),
    checking: new RecordChangeChecks(
      records,
      new FactRecorder(deletions),
      inTransaction,
    ),
    acting: new RecordHumanAction(
      WORK,
      records,
      new FactRecorder(deletions),
      inTransaction,
    ),
    deleting: new DeleteInsights(
      {
        records,
        judgings,
        scores,
        humanActions,
        failures,
        shapes,
        pullRequests,
        alertStates,
        chats,
      },
      deletions,
      inTransaction,
    ),
    judging: new RequestJudging(
      WORK,
      {
        hasTask: async () => true,
        of: async () => null,
      },
      {
        judgesOnTeam: async () => new Map(),
        judgeAt: async () => ({
          teamId: 'team_1',
          lineId: 'line_1',
          rubric: 'Did the run retry uploads?',
          rubricVersion: RUBRIC_VERSION,
          claims: [],
          passThreshold: 1,
          sample: 1,
          minAgreement: 0.6,
        }),
      },
      {
        available: true,
        judge: async () => ({
          model: 'some/model',
          verdict: { value: true, reasons: [] },
          guidance: null,
          usage: null,
        }),
      },
      judgings,
      new FactRecorder(deletions),
      inTransaction,
      CLOCK,
    ),
    scoring: new RecordJudgeScore(
      scores,
      new FactRecorder(deletions),
      inTransaction,
      {
        generate: () => {
          next += 1;
          return `score_${next}`;
        },
      },
    ),
    grading: new GradeInboxRequests({
      ask: async (taskId, runId) => {
        asked.push(`ask ${taskId.value} ${runId.value}`);
      },
      resolve: async (taskId, runId) => {
        asked.push(`resolve ${taskId.value} ${runId.value}`);
      },
    }),
    recordingUsage: new RecordRunUsageSummary(
      WORK,
      records,
      new FactRecorder(deletions),
      inTransaction,
    ),
    remembering: new RecordRunMemories(
      WORK,
      records,
      new FactRecorder(deletions),
      inTransaction,
    ),
    passing: new RecordStationPass(
      records,
      new FactRecorder(deletions),
      inTransaction,
    ),
    failing: new RecordTaskFailure(
      failures,
      new FactRecorder(deletions),
      inTransaction,
    ),
    recordingHumanActions: new RecordTaskHumanAction(
      humanActions,
      new FactRecorder(deletions),
      inTransaction,
    ),
    chatting: new RecordChat(chats, deletions, inTransaction),
    recording: new RecordPullRequests(
      pullRequests,
      new FactRecorder(deletions),
      inTransaction,
    ),
    shaping: new RecordChangeShape(
      WORK,
      shapes,
      new FactRecorder(deletions),
      inTransaction,
    ),
    watching: new WatchStations(
      lines,
      {
        facts: new StationFactsInMemory(records, { pullRequests }),
        alertStates,
      },
      new FactRecorder(deletions),
      inTransaction,
      {
        generate: () => {
          next += 1;
          return `alert_${next}`;
        },
      },
      CLOCK,
    ),
    alerting: new AlertInbox(
      {
        open: async (taskId, alertId) => {
          alerted.push(`open ${taskId.value} ${alertId.value}`);
        },
        resolve: async (taskId, alertId) => {
          alerted.push(`resolve ${taskId.value} ${alertId.value}`);
        },
      },
      alertStates,
    ),
  });

  const deliver = async (name: string, event: Record<string, unknown>) => {
    const subscriber = subscribers.find((each) => each.name === name);

    if (!subscriber) {
      throw new Error(`no subscriber ${name}`);
    }

    await subscriber.handle(event as never);
  };

  return {
    records,
    taskPullRequest: async (taskId: string) =>
      PullRequestRecord.latestOwnedOf(
        await pullRequests.ownedBy([TaskId.of(taskId)]),
      ),
    judgings,
    scores,
    humanActions,
    failures,
    chats,
    pullRequests,
    shapes,
    alertStates,
    asked,
    alerted,
    alertsNow: (next: readonly AlertRule[] | null) => {
      alertsNow = next;
    },
    subscribers,
    deliver,
    record: () => records.of(RunId.of('run_1')),
  };
};

const runEnded = (change: Record<string, unknown> = {}) => ({
  kind: RUN_ENDED,
  runId: 'run_1',
  workspaceId: 'ws_1',
  taskId: 'task_1',
  stationId: 'station_1',
  outcome: 'completed',
  failure: null,
  stopped: false,
  ...change,
});

const recordedEvent = (change: Record<string, unknown> = {}) => ({
  kind: PULL_REQUEST_UPDATED,
  workspaceId: 'ws_1',
  pullRequest: PULL,
  repository: 'acme/api',
  number: 3,
  title: 'Retry failed uploads',
  author: 'ada',
  authorIsBot: false,
  branch: null,
  additions: 1,
  deletions: 1,
  changedFiles: 1,
  openedAt: '2026-09-30T08:00:00.000Z',
  state: 'open',
  closedAt: null,
  updatedAt: '2026-09-30T08:30:00.000Z',
  readyForReviewAt: '2026-09-30T08:00:00.000Z',
  draftPeriods: [],
  reviews: [],
  reviewComments: 0,
  botComments: [],
  threads: [],
  isRevert: false,
  revertedBy: null,
  version: 1,
  ...change,
});

describe('insightsSubscribers', () => {
  it('names every subscriber within the context', () => {
    const { subscribers } = subscribed();

    expect(subscribers.every((each) => each.name.startsWith('insights.'))).toBe(
      true,
    );
    expect(new Set(subscribers.map((each) => each.name)).size).toBe(
      subscribers.length,
    );
  });

  it('records a run that ended at a station', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('insights.record-ended-run', runEnded());

    expect((await subscriber.record())?.factWith(null, null)?.ending).toBe(
      'completed',
    );
  });

  it('records a run a person stopped as stopped', async () => {
    const subscriber = subscribed();

    await subscriber.deliver(
      'insights.record-ended-run',
      runEnded({ stopped: true }),
    );

    expect((await subscriber.record())?.factWith(null, null)?.ending).toBe(
      'stopped',
    );
  });

  it('records nothing for a run at no station', async () => {
    const subscriber = subscribed();

    await subscriber.deliver(
      'insights.record-ended-run',
      runEnded({ stationId: null }),
    );

    expect(await subscriber.record()).toBeNull();
  });

  it('records nothing for a change checked for no task, as a replay’s is', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('insights.record-checked-change', {
      kind: CHANGE_CHECKED,
      runId: 'run_1',
      taskId: null,
      workspaceId: 'ws_1',
      passed: true,
    });

    expect(await subscriber.record()).toBeNull();
  });

  it('fills in the checks, the first human action and the superseding in any order', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('insights.record-checked-change', {
      kind: CHANGE_CHECKED,
      runId: 'run_1',
      taskId: 'task_1',
      workspaceId: 'ws_1',
      passed: true,
    });
    await subscriber.deliver('insights.record-first-human-action', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      action: 'sent-back',
      by: 'user_ada',
      afterRunId: 'run_1',
      at: '2026-09-30T11:00:00.000Z',
      tool: null,
      server: null,
    });
    await subscriber.deliver('insights.record-superseded-run', {
      kind: RUN_SUPERSEDED,
      runId: 'run_1',
      workspaceId: 'ws_1',
      taskId: 'task_1',
    });
    await subscriber.deliver('insights.record-ended-run', runEnded());

    const record = await subscriber.record();
    expect(record?.checks).toBe('passed');
    expect(record?.firstHumanAction?.kind).toBe('sent-back');
    expect(record?.factWith(null, null)?.ending).toBe('superseded');
  });

  it('follows the task’s pull request from opened to merged', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('insights.record-pull-request-owner', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });
    await subscriber.deliver(
      'insights.record-seen-pull-request',
      recordedEvent({
        state: 'merged',
        closedAt: '2026-09-30T12:00:00.000Z',
        updatedAt: '2026-09-30T12:00:00.000Z',
        version: 2,
      }),
    );

    expect((await subscriber.taskPullRequest('task_1'))?.state).toBe('merged');
  });

  it('keeps what a run cost and where it passed its task, received before or after it ended', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('insights.record-run-usage', {
      kind: RUN_USAGE_RECORDED,
      runId: 'run_1',
      workspaceId: 'ws_1',
      requester: {
        owner: 'work',
        kind: 'task',
        id: 'task_1',
        token: '0',
        team: 'team_1',
      },
      listed: true,
      ms: 60_000,
      steps: 12,
      errors: 1,
      changedLines: 40,
      contextTokens: 40_000,
      contextWindow: 200_000,
      cost: 0.42,
      currency: 'USD',
      spentCosts: [{ amount: 0.42, currency: 'USD' }],
      unpricedCalls: 0,
      inputTokens: 1_200,
      outputTokens: 900,
      cacheReadTokens: 80_000,
      cacheWriteTokens: null,
      servers: [
        {
          server: 'linear',
          calls: 2,
          failed: 1,
          latency: LatencyHistogram.timing([300, 900]).counts,
          lastCallFailed: true,
        },
      ],
      skillsRead: ['grafana'],
    });
    await subscriber.deliver('insights.record-ended-run', runEnded());
    await subscriber.deliver('insights.record-passed-run', {
      kind: TASK_PASSED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      runId: 'run_1',
      from: 'station_1',
      to: 'station_2',
      at: '2026-09-30T10:01:00.000Z',
    });

    const record = await subscriber.record();
    expect(record?.usage?.spend).toEqual({ amount: 0.42, currency: 'USD' });
    expect(record?.usage?.tokens).toEqual({
      input: 1_200,
      output: 900,
      cacheRead: 80_000,
      cacheWrite: null,
    });
    expect(record?.passed?.to.value).toBe('station_2');
    expect(record?.end?.agentConfig.harness).toBe('claude-code');
    expect(
      record?.tools?.servers.find((each) => each.server === 'linear')?.latency,
    ).toEqual(LatencyHistogram.timing([300, 900]));
    expect(record?.tools?.skillsRead.includes('grafana')).toBe(true);
  });

  it('keeps no cost for a run that worked no task', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('insights.record-run-usage', {
      kind: RUN_USAGE_RECORDED,
      runId: 'run_chat',
      workspaceId: 'ws_1',
      requester: {
        owner: 'work',
        kind: 'chat',
        id: 'chat_1',
        token: null,
        team: 'team_1',
      },
      listed: true,
      ms: 60_000,
      steps: 12,
      errors: 1,
      changedLines: 0,
      contextTokens: null,
      contextWindow: null,
      cost: 0.42,
      currency: 'USD',
      spentCosts: [{ amount: 0.42, currency: 'USD' }],
      unpricedCalls: 0,
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      servers: [],
      skillsRead: [],
    });

    expect(await subscriber.record()).toBeNull();
  });

  it('keeps the memories a run used, received before and after it ended', async () => {
    const subscriber = subscribed();
    const used = (via: string, memories: readonly string[]) =>
      subscriber.deliver('insights.record-run-memories', {
        kind: MEMORIES_USED,
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId: 'task_1',
        via,
        memories,
      });

    await used('briefed', ['mem_1']);
    await subscriber.deliver('insights.record-ended-run', runEnded());
    await used('recalled', ['mem_2']);

    expect((await subscriber.record())?.hasEnded).toBe(true);
    expect((await subscriber.record())?.memories).toMatchObject({
      briefed: ['mem_1'],
      recalled: ['mem_2'],
    });
  });

  it('keeps no memories for a run that worked no task, nor for a channel it does not know', async () => {
    const subscriber = subscribed();
    const used = (taskId: string | null, via: string) =>
      subscriber.deliver('insights.record-run-memories', {
        kind: MEMORIES_USED,
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId,
        via,
        memories: ['mem_1'],
      });

    await used(null, 'briefed');
    await used('task_1', 'unknown');

    expect(await subscriber.record()).toBeNull();
  });

  it('dates a pull request’s first review by a person, never a bot’s', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.record-pull-request-owner', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });
    const reviewed = (id: number, byBot: boolean, submittedAt: string) => ({
      id,
      state: 'commented',
      login: byBot ? 'spotlight[bot]' : 'ada',
      byBot,
      submittedAt,
      dismissed: false,
    });

    await subscriber.deliver(
      'insights.record-seen-pull-request',
      recordedEvent({
        reviews: [
          reviewed(1, true, '2026-09-30T10:40:00.000Z'),
          reviewed(2, false, '2026-09-30T11:00:00.000Z'),
          reviewed(3, false, '2026-09-30T12:00:00.000Z'),
        ],
      }),
    );

    expect((await subscriber.taskPullRequest('task_1'))?.firstReviewAt).toEqual(
      new Date('2026-09-30T11:00:00.000Z'),
    );
  });

  it('keeps every task failure received, once each', async () => {
    const subscriber = subscribed();
    const failed = (occurrences: number, at: string) => ({
      kind: TASK_FAILED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      stationId: 'station_1',
      runId: null,
      source: 'hook:notify',
      code: 'loop',
      occurrences,
      at,
    });

    await subscriber.deliver(
      'insights.record-task-failure',
      failed(1, '2026-09-30T10:00:00.000Z'),
    );
    await subscriber.deliver(
      'insights.record-task-failure',
      failed(2, '2026-09-30T10:01:00.000Z'),
    );
    await subscriber.deliver(
      'insights.record-task-failure',
      failed(2, '2026-09-30T10:01:00.000Z'),
    );

    const failures = await subscriber.failures.of(TaskId.of('task_1'));
    expect(failures?.occurrences.map((each) => each.occurrences)).toEqual([
      1, 2,
    ]);
  });

  it('keeps who opened a task, what it asked of people and what they did', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('insights.record-inbox-ask', {
      kind: TASK_ASKED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      at: '2026-09-30T10:10:00.000Z',
    });
    await subscriber.deliver('insights.record-task-opening', {
      kind: TASK_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_0',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    await subscriber.deliver('insights.record-task-human-action', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      action: 'answered',
      by: 'user_bob',
      afterRunId: 'run_1',
      at: '2026-09-30T10:20:00.000Z',
      tool: null,
      server: null,
    });

    const humanActions = await subscriber.humanActions.of(TaskId.of('task_1'));
    expect(humanActions?.opening?.by?.value).toBe('user_ada');
    expect(
      humanActions?.asks.map((each) => [each.stationId.value, each.at]),
    ).toEqual([['station_1', new Date('2026-09-30T10:10:00.000Z')]]);
    expect(
      humanActions?.actions.map((each) => [each.by.value, each.at]),
    ).toEqual([['user_bob', new Date('2026-09-30T10:20:00.000Z')]]);
  });

  it('keeps who started a chat, once', async () => {
    const subscriber = subscribed();
    const started = {
      kind: CHAT_STARTED,
      chatId: 'chat_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    };

    await subscriber.deliver('insights.record-started-chat', started);
    await subscriber.deliver('insights.record-started-chat', started);

    expect(subscriber.chats.stored.size).toBe(1);
  });

  it('deletes the human actions and failures of a deleted task, and the chats of a deleted workspace', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.record-inbox-ask', {
      kind: TASK_ASKED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      at: '2026-09-30T10:10:00.000Z',
    });
    await subscriber.deliver('insights.record-task-failure', {
      kind: TASK_FAILED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      stationId: 'station_1',
      runId: 'run_1',
      source: 'run',
      code: 'exited',
      occurrences: 1,
      at: '2026-09-30T10:00:00.000Z',
    });
    await subscriber.deliver('insights.record-started-chat', {
      kind: CHAT_STARTED,
      chatId: 'chat_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    const deleted = {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    };

    await subscriber.deliver(
      'insights.delete-human-actions-of-deleted-task',
      deleted,
    );
    await subscriber.deliver(
      'insights.delete-failures-of-deleted-task',
      deleted,
    );
    await subscriber.deliver('insights.delete-chats-of-deleted-workspace', {
      kind: WORKSPACE_DELETED,
      workspaceId: 'ws_1',
      slug: 'acme',
    });

    expect(subscriber.humanActions.stored.size).toBe(0);
    expect(subscriber.failures.stored.size).toBe(0);
    expect(subscriber.chats.stored.size).toBe(0);
  });

  it('deletes the runs and pull request of a deleted task', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.record-ended-run', runEnded());
    await subscriber.deliver('insights.record-pull-request-owner', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });
    const deleted = {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    };

    await subscriber.deliver('insights.delete-runs-of-deleted-task', deleted);
    await subscriber.deliver(
      'insights.delete-pull-requests-of-deleted-task',
      deleted,
    );

    expect(await subscriber.record()).toBeNull();
    expect(await subscriber.taskPullRequest('task_1')).toBeNull();
  });

  it('deletes the runs of a deleted team', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.record-ended-run', runEnded());

    await subscriber.deliver('insights.delete-runs-of-deleted-team', {
      kind: TEAM_DELETED,
      workspaceId: 'ws_1',
      teamId: 'team_1',
      key: 'core',
    });

    expect(await subscriber.record()).toBeNull();
  });

  it('dates a pull request’s first review even when GitHub’s word is received before the opening', async () => {
    const subscriber = subscribed();
    await subscriber.deliver(
      'insights.record-seen-pull-request',
      recordedEvent({
        reviews: [
          {
            id: 1,
            state: 'approved',
            login: 'ada',
            byBot: false,
            submittedAt: '2026-09-30T11:00:00.000Z',
            dismissed: false,
          },
        ],
      }),
    );

    await subscriber.deliver('insights.record-pull-request-owner', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });

    expect((await subscriber.taskPullRequest('task_1'))?.firstReviewAt).toEqual(
      new Date('2026-09-30T11:00:00.000Z'),
    );
  });

  it('deletes the failures and pull requests of a deleted team', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.record-task-failure', {
      kind: TASK_FAILED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      stationId: 'station_1',
      runId: null,
      source: 'hook:notify',
      code: 'loop',
      occurrences: 1,
      at: '2026-09-30T10:00:00.000Z',
    });
    await subscriber.deliver('insights.record-pull-request-owner', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });
    const deletedTeam = {
      kind: TEAM_DELETED,
      workspaceId: 'ws_1',
      teamId: 'team_1',
      key: 'core',
    };

    await subscriber.deliver(
      'insights.delete-failures-of-deleted-team',
      deletedTeam,
    );
    await subscriber.deliver(
      'insights.delete-pull-requests-of-deleted-team',
      deletedTeam,
    );

    expect(subscriber.failures.stored.size).toBe(0);
    expect(await subscriber.taskPullRequest('task_1')).toBeNull();
  });

  it('records nothing more of a task received after it was deleted, whichever deletion came first', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.delete-human-actions-of-deleted-task', {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    });

    await subscriber.deliver('insights.record-ended-run', runEnded());
    await subscriber.deliver('insights.record-run-usage', {
      kind: RUN_USAGE_RECORDED,
      runId: 'run_1',
      workspaceId: 'ws_1',
      requester: {
        owner: 'work',
        kind: 'task',
        id: 'task_1',
        token: '0',
        team: 'team_1',
      },
      listed: true,
      ms: 60_000,
      steps: 12,
      errors: 1,
      changedLines: 0,
      contextTokens: null,
      contextWindow: null,
      cost: 0.42,
      currency: 'USD',
      spentCosts: [{ amount: 0.42, currency: 'USD' }],
      unpricedCalls: 0,
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      servers: [],
      skillsRead: [],
    });
    await subscriber.deliver('insights.record-passed-run', {
      kind: TASK_PASSED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      runId: 'run_2',
      from: 'station_1',
      to: 'station_2',
      at: '2026-09-30T10:01:00.000Z',
    });
    await subscriber.deliver('insights.record-checked-change', {
      kind: CHANGE_CHECKED,
      runId: 'run_3',
      workspaceId: 'ws_1',
      taskId: 'task_1',
      passed: true,
    });
    await subscriber.deliver('insights.record-superseded-run', {
      kind: RUN_SUPERSEDED,
      runId: 'run_4',
      workspaceId: 'ws_1',
      taskId: 'task_1',
    });
    await subscriber.deliver('insights.record-first-human-action', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      action: 'answered',
      by: 'user_bob',
      afterRunId: 'run_5',
      at: '2026-09-30T10:20:00.000Z',
      tool: null,
      server: null,
    });
    await subscriber.deliver('insights.record-inbox-ask', {
      kind: TASK_ASKED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      at: '2026-09-30T10:10:00.000Z',
    });
    await subscriber.deliver('insights.record-task-failure', {
      kind: TASK_FAILED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      stationId: 'station_1',
      runId: null,
      source: 'hook:notify',
      code: 'loop',
      occurrences: 1,
      at: '2026-09-30T10:00:00.000Z',
    });
    await subscriber.deliver('insights.record-pull-request-owner', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });

    expect(subscriber.records.stored.size).toBe(0);
    expect(subscriber.humanActions.stored.size).toBe(0);
    expect(subscriber.failures.stored.size).toBe(0);
    expect(subscriber.pullRequests.stored.size).toBe(0);
  });

  it('records nothing more of a team received after it was deleted, and lets go of what it received before it knew the team', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.record-inbox-ask', {
      kind: TASK_ASKED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      at: '2026-09-30T10:10:00.000Z',
    });
    await subscriber.deliver('insights.delete-chats-of-deleted-team', {
      kind: TEAM_DELETED,
      workspaceId: 'ws_1',
      teamId: 'team_1',
      key: 'core',
    });

    await subscriber.deliver('insights.record-ended-run', runEnded());
    await subscriber.deliver('insights.record-started-chat', {
      kind: CHAT_STARTED,
      chatId: 'chat_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    await subscriber.deliver('insights.record-task-opening', {
      kind: TASK_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_0',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    await subscriber.deliver('insights.record-task-failure', {
      kind: TASK_FAILED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      stationId: 'station_1',
      runId: null,
      source: 'hook:notify',
      code: 'loop',
      occurrences: 1,
      at: '2026-09-30T10:00:00.000Z',
    });

    expect(subscriber.records.stored.size).toBe(0);
    expect(subscriber.chats.stored.size).toBe(0);
    expect(subscriber.humanActions.stored.size).toBe(0);
    expect(subscriber.failures.stored.size).toBe(0);
  });

  it('records no later ask or act of a task whose team was deleted, whichever came first', async () => {
    const opened = {
      kind: TASK_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_0',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    };
    const teamDeleted = {
      kind: TEAM_DELETED,
      workspaceId: 'ws_1',
      teamId: 'team_1',
      key: 'core',
    };
    const asked = {
      kind: TASK_ASKED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      at: '2026-09-30T10:10:00.000Z',
    };
    const acted = {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      action: 'answered',
      by: 'user_bob',
      afterRunId: null,
      at: '2026-09-30T10:20:00.000Z',
      tool: null,
      server: null,
    };
    const openedFirst = subscribed();
    const deletedFirst = subscribed();

    await openedFirst.deliver('insights.record-task-opening', opened);
    await openedFirst.deliver(
      'insights.delete-human-actions-of-deleted-team',
      teamDeleted,
    );
    await openedFirst.deliver('insights.record-inbox-ask', asked);
    await openedFirst.deliver('insights.record-task-human-action', acted);
    await deletedFirst.deliver(
      'insights.delete-human-actions-of-deleted-team',
      teamDeleted,
    );
    await deletedFirst.deliver('insights.record-inbox-ask', asked);
    await deletedFirst.deliver('insights.record-task-opening', opened);
    await deletedFirst.deliver('insights.record-task-human-action', acted);

    expect(openedFirst.humanActions.stored.size).toBe(0);
    expect(deletedFirst.humanActions.stored.size).toBe(0);
  });

  it('records nothing more of a workspace received after it was deleted', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.delete-chats-of-deleted-workspace', {
      kind: WORKSPACE_DELETED,
      workspaceId: 'ws_1',
      slug: 'acme',
    });

    await subscriber.deliver('insights.record-ended-run', runEnded());
    await subscriber.deliver('insights.record-started-chat', {
      kind: CHAT_STARTED,
      chatId: 'chat_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    await subscriber.deliver('insights.record-task-opening', {
      kind: TASK_OPENED,
      taskId: 'task_2',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_0',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    await subscriber.deliver(
      'insights.record-seen-pull-request',
      recordedEvent(),
    );

    expect(subscriber.records.stored.size).toBe(0);
    expect(subscriber.chats.stored.size).toBe(0);
    expect(subscriber.humanActions.stored.size).toBe(0);
    expect(subscriber.pullRequests.stored.size).toBe(0);
  });

  it('deletes everything of a deleted workspace', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.record-ended-run', runEnded());
    await subscriber.deliver('insights.record-pull-request-owner', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });
    const deletedWorkspace = {
      kind: WORKSPACE_DELETED,
      workspaceId: 'ws_1',
      slug: 'acme',
    };

    await subscriber.deliver(
      'insights.delete-runs-of-deleted-workspace',
      deletedWorkspace,
    );
    await subscriber.deliver(
      'insights.delete-pull-requests-of-deleted-workspace',
      deletedWorkspace,
    );

    expect(subscriber.records.stored.size).toBe(0);
    expect(subscriber.pullRequests.stored.size).toBe(0);
  });

  it('requests a judge’s verdict on a run that ended at a judged station', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('insights.judge-ended-run', runEnded());
    await subscriber.deliver('insights.judge-ended-run', runEnded());

    const judging = await subscriber.judgings.of(RunId.of('run_1'));
    expect(judging?.hasPendingJob).toBe(true);
    expect(judging?.rubric.version).toBe(RUBRIC_VERSION);
    expect(subscriber.judgings.stored.size).toBe(1);
  });

  it('judges neither a cancelled run nor one at no station', async () => {
    const subscriber = subscribed();

    await subscriber.deliver(
      'insights.judge-ended-run',
      runEnded({ outcome: 'cancelled' }),
    );
    await subscriber.deliver(
      'insights.judge-ended-run',
      runEnded({ stationId: null }),
    );

    expect(subscriber.judgings.stored.size).toBe(0);
  });

  it('records the judge’s score once, however often the verdict is received', async () => {
    const subscriber = subscribed();
    const judged = new RunJudged(
      RunId.of('run_1'),
      queuedJudging().workspaceId,
      queuedJudging().location,
      null,
      RUBRIC_VERSION,
      ScoreScale.yesNo(),
      1,
      null,
      'some/model',
      [reasonOf()],
      SeenEvidence.none(),
      new Date('2026-09-30T10:05:00.000Z'),
    );

    await subscriber.deliver('insights.judge-ended-run', runEnded());
    await subscriber.deliver('insights.record-judge-score', judged as never);
    await subscriber.deliver('insights.record-judge-score', judged as never);

    const [score, ...rest] = [...subscriber.scores.stored.values()];
    expect(rest).toEqual([]);
    expect(score?.source).toBe('judge');
    expect(score?.value).toBe(1);
  });

  it('requests no judging of a run whose end is received after its task was deleted', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.delete-runs-of-deleted-task', {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    });

    await subscriber.deliver('insights.judge-ended-run', runEnded());

    expect(subscriber.judgings.stored.size).toBe(0);
  });

  it('records no score for a verdict received after its task was deleted', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.judge-ended-run', runEnded());
    await subscriber.deliver('insights.delete-judgings-of-deleted-task', {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    });

    await subscriber.deliver(
      'insights.record-judge-score',
      new RunJudged(
        RunId.of('run_1'),
        queuedJudging().workspaceId,
        queuedJudging().location,
        null,
        RUBRIC_VERSION,
        ScoreScale.yesNo(),
        1,
        null,
        'some/model',
        [reasonOf()],
        SeenEvidence.none(),
        new Date('2026-09-30T10:05:00.000Z'),
      ) as never,
    );

    expect(subscriber.scores.stored.size).toBe(0);
  });

  it('resolves the grade inbox request of a run once a person grades it', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('insights.ask-or-resolve-grade', {
      kind: 'score.recorded',
      scoreId: 'score_1',
      runId: RunId.of('run_1'),
      location: queuedJudging().location,
      source: 'person',
    } as never);

    expect(subscriber.asked).toEqual(['resolve task_1 run_1']);
  });

  it('deletes the judgings and the scores of a deleted task, each in its own reaction', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('insights.judge-ended-run', runEnded());
    await subscriber.scores.add(
      judgeScore('run_1', ScoreScale.yesNo(), 1, { taskId: 'task_1' }),
    );
    const deleted = {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    };

    await subscriber.deliver(
      'insights.delete-judgings-of-deleted-task',
      deleted,
    );
    await subscriber.deliver('insights.delete-scores-of-deleted-task', deleted);

    expect(subscriber.judgings.stored.size).toBe(0);
    expect(subscriber.scores.stored.size).toBe(0);
  });

  describe('every pull request in the team’s repositories', () => {
    const recordOf = (subscriber: ReturnType<typeof subscribed>) =>
      subscriber.pullRequests.at(
        WorkspaceId.of('ws_1'),
        PullRequestUrl.of(PULL),
      );

    it('records a pull request no task owns, as people’s', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent(),
      );

      const record = await recordOf(subscriber);
      expect(record?.seen?.title).toBe('Retry failed uploads');
      expect(record?.owner).toBeNull();
    });

    it('records when it was ready for review, reviewed, approved, and what bots did on it, from what GitHub saw', async () => {
      const subscriber = subscribed();
      const bot = 'coderabbitai[bot]';
      const review = (
        id: number,
        state: string,
        submittedAt: string,
        over: Record<string, unknown> = {},
      ) => ({
        id,
        state,
        login: 'grace',
        byBot: false,
        submittedAt,
        dismissed: false,
        ...over,
      });

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent({
          readyForReviewAt: '2026-09-30T09:00:00.000Z',
          draftPeriods: [
            {
              from: '2026-09-30T09:20:00.000Z',
              to: '2026-09-30T09:25:00.000Z',
            },
            { from: '2026-09-30T11:00:00.000Z', to: null },
          ],
          reviews: [
            review(1, 'commented', '2026-09-30T09:10:00.000Z', {
              login: bot,
              byBot: true,
            }),
            review(2, 'changes-requested', '2026-09-30T09:30:00.000Z'),
            review(3, 'approved', '2026-09-30T10:00:00.000Z'),
            review(4, 'approved', '2026-09-30T09:40:00.000Z', {
              dismissed: true,
            }),
          ],
          botComments: [
            {
              id: 10,
              on: 'line',
              login: bot,
              opensThread: true,
              deleted: false,
            },
            {
              id: 11,
              on: 'line',
              login: bot,
              opensThread: false,
              deleted: false,
            },
            {
              id: 12,
              on: 'conversation',
              login: bot,
              opensThread: false,
              deleted: false,
            },
            {
              id: 13,
              on: 'line',
              login: bot,
              opensThread: true,
              deleted: true,
            },
          ],
          threads: [
            {
              id: 'PRRT_1',
              firstCommentId: 10,
              login: bot,
              byBot: true,
              resolved: true,
            },
            {
              id: 'PRRT_2',
              firstCommentId: null,
              login: bot,
              byBot: true,
              resolved: false,
            },
          ],
        }),
      );

      expect((await recordOf(subscriber))?.seen).toMatchObject({
        readyForReviewAt: new Date('2026-09-30T09:00:00.000Z'),
        draftPeriods: [
          {
            from: new Date('2026-09-30T09:20:00.000Z'),
            to: new Date('2026-09-30T09:25:00.000Z'),
          },
          { from: new Date('2026-09-30T11:00:00.000Z'), to: null },
        ],
        firstReviewAt: new Date('2026-09-30T09:30:00.000Z'),
        firstUnblockingReviewAt: new Date('2026-09-30T09:10:00.000Z'),
        firstApprovedAt: new Date('2026-09-30T10:00:00.000Z'),
        humanReviewedAt: [
          new Date('2026-09-30T09:30:00.000Z'),
          new Date('2026-09-30T10:00:00.000Z'),
        ],
        reviews: 2,
        reviewRounds: 2,
        botActivity: [
          {
            login: bot,
            reviews: 1,
            comments: 3,
            threads: 2,
            resolvedThreads: 1,
          },
        ],
      });
    });

    it('makes it Spotlight’s whichever it receives first, the pull request or the task opening it', async () => {
      const subscriber = subscribed();

      await subscriber.deliver('insights.record-pull-request-owner', {
        kind: PULL_REQUEST_OPENED,
        taskId: 'task_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        url: PULL,
        at: '2026-09-30T08:00:00.000Z',
      });
      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent(),
      );

      const record = await recordOf(subscriber);
      expect(record?.owner?.taskId.value).toBe('task_1');
      expect(record?.seen?.number).toBe(3);
    });

    it('keeps the newest of what GitHub said, however late an older word arrives', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent({ state: 'merged', version: 4 }),
      );
      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent({ state: 'open', version: 2 }),
      );

      expect((await recordOf(subscriber))?.seen?.state).toBe('merged');
    });

    it('marks people’s pull request reviewed once a review task ran on it', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent(),
      );
      await subscriber.deliver('insights.record-pull-request-review-task', {
        kind: PULL_REQUEST_REVIEW_TAKEN,
        taskId: 'task_9',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        url: PULL,
      });

      expect(
        (await recordOf(subscriber))?.reviewTasks.map((each) => ({
          taskId: each.taskId.value,
          teamId: each.teamId.value,
        })),
      ).toEqual([{ taskId: 'task_9', teamId: 'team_1' }]);
    });

    const CLOSED_AT = '2026-03-01T08:00:00.000Z';

    const closedEvent = (change: Record<string, unknown> = {}) =>
      recordedEvent({
        state: 'closed',
        closedAt: CLOSED_AT,
        updatedAt: CLOSED_AT,
        ...change,
      });

    const purgedEvent = (updatedAt = CLOSED_AT) => ({
      kind: PULL_REQUEST_PURGED,
      workspaceId: 'ws_1',
      pullRequest: PULL,
      updatedAt,
    });

    const ownedEvent = (taskId = 'task_1', teamId = 'team_1') => ({
      kind: PULL_REQUEST_OPENED,
      taskId,
      workspaceId: 'ws_1',
      teamId,
      url: PULL,
      at: '2026-09-30T08:00:00.000Z',
    });

    it('keeps only a tombstone of people’s pull request once GitHub purges it, and never takes it back from a late word', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        closedEvent(),
      );
      await subscriber.deliver(
        'insights.delete-pull-request-purged-by-github',
        purgedEvent(),
      );
      await subscriber.deliver(
        'insights.record-seen-pull-request',
        closedEvent({ version: 3 }),
      );

      expect((await recordOf(subscriber))?.isTombstone).toBe(true);
      expect((await recordOf(subscriber))?.seen).toBeNull();
    });

    it('turns away a late word GitHub said no later than it purged it, even one saying it is open', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        closedEvent(),
      );
      await subscriber.deliver(
        'insights.delete-pull-request-purged-by-github',
        purgedEvent(),
      );
      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent({ updatedAt: CLOSED_AT, version: 9 }),
      );

      expect((await recordOf(subscriber))?.seen).toBeNull();
    });

    it('takes a purged pull request back once GitHub changes it later, at any version', async () => {
      const reopened = subscribed();
      const closedLater = subscribed();

      for (const subscriber of [reopened, closedLater]) {
        await subscriber.deliver(
          'insights.record-seen-pull-request',
          closedEvent(),
        );
        await subscriber.deliver(
          'insights.delete-pull-request-purged-by-github',
          purgedEvent(),
        );
      }
      await reopened.deliver(
        'insights.record-seen-pull-request',
        recordedEvent({ title: 'Reopened' }),
      );
      await closedLater.deliver(
        'insights.record-seen-pull-request',
        closedEvent({
          closedAt: '2026-09-30T08:00:00.000Z',
          updatedAt: '2026-09-30T08:00:00.000Z',
          title: 'Again',
        }),
      );

      expect((await recordOf(reopened))?.seen?.title).toBe('Reopened');
      expect((await recordOf(closedLater))?.seen?.title).toBe('Again');
    });

    it('keeps Spotlight’s pull request after GitHub purges it, and reads it anew once GitHub records it again', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        closedEvent({ version: 5 }),
      );
      await subscriber.deliver(
        'insights.record-pull-request-owner',
        ownedEvent(),
      );
      await subscriber.deliver(
        'insights.delete-pull-request-purged-by-github',
        purgedEvent(),
      );

      expect((await recordOf(subscriber))?.seen?.number).toBe(3);

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent({ title: 'Reopened', version: 1 }),
      );

      expect((await recordOf(subscriber))?.seen?.title).toBe('Reopened');
    });

    it('keeps only a tombstone of a deleted task’s pull request GitHub already purged', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        closedEvent(),
      );
      await subscriber.deliver(
        'insights.record-pull-request-owner',
        ownedEvent(),
      );
      await subscriber.deliver(
        'insights.delete-pull-request-purged-by-github',
        purgedEvent(),
      );
      await subscriber.deliver(
        'insights.delete-pull-requests-of-deleted-task',
        {
          kind: TASK_DELETED,
          taskId: 'task_1',
          workspaceId: 'ws_1',
        },
      );

      expect((await recordOf(subscriber))?.isTombstone).toBe(true);
    });

    it('keeps what GitHub said of a deleted team’s pull request, as nobody’s', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent(),
      );
      await subscriber.deliver(
        'insights.record-pull-request-owner',
        ownedEvent(),
      );
      await subscriber.deliver(
        'insights.delete-pull-requests-of-deleted-team',
        {
          kind: TEAM_DELETED,
          workspaceId: 'ws_1',
          teamId: 'team_1',
        },
      );

      const record = await recordOf(subscriber);
      expect(record?.owner).toBeNull();
      expect(record?.seen?.number).toBe(3);
    });

    it('keeps only a tombstone of a deleted team’s pull request GitHub already purged', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        closedEvent(),
      );
      await subscriber.deliver(
        'insights.record-pull-request-owner',
        ownedEvent(),
      );
      await subscriber.deliver(
        'insights.delete-pull-request-purged-by-github',
        purgedEvent(),
      );
      await subscriber.deliver(
        'insights.delete-pull-requests-of-deleted-team',
        {
          kind: TEAM_DELETED,
          workspaceId: 'ws_1',
          teamId: 'team_1',
        },
      );

      expect((await recordOf(subscriber))?.isTombstone).toBe(true);
    });

    it('leaves another team’s pull request alone when a team is deleted', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent(),
      );
      await subscriber.deliver(
        'insights.record-pull-request-owner',
        ownedEvent('task_1', 'team_2'),
      );
      await subscriber.deliver(
        'insights.delete-pull-requests-of-deleted-team',
        {
          kind: TEAM_DELETED,
          workspaceId: 'ws_1',
          teamId: 'team_1',
        },
      );

      expect((await recordOf(subscriber))?.owner?.teamId.value).toBe('team_2');
    });

    it('lets go of a deleted task’s pull requests but keeps what GitHub said of them', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent(),
      );
      await subscriber.deliver('insights.record-pull-request-owner', {
        kind: PULL_REQUEST_OPENED,
        taskId: 'task_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        url: PULL,
        at: '2026-09-30T08:00:00.000Z',
      });
      await subscriber.deliver(
        'insights.delete-pull-requests-of-deleted-task',
        {
          kind: TASK_DELETED,
          taskId: 'task_1',
          workspaceId: 'ws_1',
        },
      );
      await subscriber.deliver('insights.record-pull-request-owner', {
        kind: PULL_REQUEST_OPENED,
        taskId: 'task_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        url: PULL,
        at: '2026-09-30T08:00:00.000Z',
      });

      const record = await recordOf(subscriber);
      expect(record?.owner).toBeNull();
      expect(record?.seen?.number).toBe(3);
    });

    it('deletes every pull request of a deleted workspace', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent(),
      );
      await subscriber.deliver(
        'insights.delete-pull-requests-of-deleted-workspace',
        {
          kind: WORKSPACE_DELETED,
          workspaceId: 'ws_1',
        },
      );
      await subscriber.deliver(
        'insights.record-seen-pull-request',
        recordedEvent(),
      );

      expect(await recordOf(subscriber)).toBeNull();
    });

    it('records no cohorts a change stack claims for another task or workspace than its run’s', async () => {
      const subscriber = subscribed();

      await subscriber.deliver('insights.record-change-shape', {
        kind: CHANGE_STACK_READY,
        runId: 'run_1',
        taskId: 'task_2',
        workspaceId: 'ws_1',
        changeTitles: ['Fix the retry loop'],
        changeIntents: [''],
        at: '2026-09-30T10:00:00.000Z',
      });
      await subscriber.deliver('insights.record-change-shape', {
        kind: CHANGE_STACK_READY,
        runId: 'run_1',
        taskId: 'task_1',
        workspaceId: 'ws_2',
        changeTitles: ['Fix the retry loop'],
        changeIntents: [''],
        at: '2026-09-30T10:00:00.000Z',
      });

      expect(await subscriber.shapes.forTask(TaskId.of('task_1'))).toBeNull();
      expect(await subscriber.shapes.forTask(TaskId.of('task_2'))).toBeNull();
    });

    it('records the cohorts of the latest change stack a task’s run left', async () => {
      const subscriber = subscribed();

      await subscriber.deliver('insights.record-change-shape', {
        kind: CHANGE_STACK_READY,
        runId: 'run_1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        changeTitles: ['Fix the retry loop'],
        changeIntents: ['Stop dropping uploads'],
        at: '2026-09-30T10:00:00.000Z',
      });
      await subscriber.deliver('insights.record-change-shape', {
        kind: CHANGE_STACK_READY,
        runId: 'run_unknown',
        taskId: 'task_2',
        workspaceId: 'ws_1',
        changeTitles: ['Add a flag'],
        changeIntents: [''],
        at: '2026-09-30T10:00:00.000Z',
      });

      expect(
        (await subscriber.shapes.forTask(TaskId.of('task_1')))?.shape
          .changeTitles,
      ).toEqual(['Fix the retry loop']);
      expect(
        (await subscriber.shapes.forTask(TaskId.of('task_1')))?.teamId.value,
      ).toBe('team_1');
      expect(await subscriber.shapes.forTask(TaskId.of('task_2'))).toBeNull();
    });
  });

  describe('station alerts', () => {
    const FAILING_ABOVE_HALF = AlertRule.of({
      measure: 'failed_rate',
      above: 0.5,
      over: 1,
    });

    const watched = async (
      subscriber: ReturnType<typeof subscribed>,
      runId: string,
    ) => {
      const record = await subscriber.records.of(RunId.of(runId));

      if (!record?.end) {
        throw new Error(`no ended run ${runId}`);
      }

      await subscriber.deliver(
        'insights.watch-station-after-run',
        new RunRecordEnded(
          record.runId,
          record.workspaceId,
          record.end.location,
        ) as never,
      );
    };

    it('creates one inbox request on the run that fired a station’s alert, and resolves it once the alert resolves', async () => {
      const subscriber = subscribed([FAILING_ABOVE_HALF]);
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));

      await watched(subscriber, 'run_1');
      await watched(subscriber, 'run_1');
      const [fired] = subscriber.alertStates.raised;
      await subscriber.deliver(
        'insights.follow-station-alert-inbox-request',
        fired as never,
      );

      expect(subscriber.alerted).toEqual(['open task_1 alert_1']);

      await subscriber.records.add(
        endedRecord('run_2', {
          taskId: 'task_2',
          endedAt: new Date('2026-09-30T11:00:00.000Z'),
        }),
      );
      await watched(subscriber, 'run_2');
      const resolved = subscriber.alertStates.raised[1];
      await subscriber.deliver(
        'insights.follow-station-alert-inbox-request',
        resolved as never,
      );

      expect(subscriber.alerted).toEqual([
        'open task_1 alert_1',
        'resolve task_1 alert_1',
      ]);
    });

    it('resolves the inbox request even when the firing is received after the resolution', async () => {
      const subscriber = subscribed([FAILING_ABOVE_HALF]);
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));
      await watched(subscriber, 'run_1');
      await subscriber.records.add(
        endedRecord('run_2', {
          taskId: 'task_2',
          endedAt: new Date('2026-09-30T11:00:00.000Z'),
        }),
      );
      await watched(subscriber, 'run_2');
      const [fired, resolved] = subscriber.alertStates.raised;

      await subscriber.deliver(
        'insights.follow-station-alert-inbox-request',
        resolved as never,
      );
      await subscriber.deliver(
        'insights.follow-station-alert-inbox-request',
        fired as never,
      );

      expect(subscriber.alerted).toEqual([
        'resolve task_1 alert_1',
        'resolve task_1 alert_1',
      ]);
    });

    it('deletes the alerts of a deleted team and fires none for it after', async () => {
      const subscriber = subscribed([FAILING_ABOVE_HALF]);
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));
      await watched(subscriber, 'run_1');

      await subscriber.deliver('insights.delete-alerts-of-deleted-team', {
        kind: TEAM_DELETED,
        teamId: 'team_1',
        workspaceId: 'ws_1',
      });
      await watched(subscriber, 'run_1');

      expect(subscriber.alertStates.stored.size).toBe(0);
    });

    it('re-checks a changed line’s stations, resolving an alert whose rule is gone', async () => {
      const subscriber = subscribed([FAILING_ABOVE_HALF]);
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));
      await watched(subscriber, 'run_1');
      subscriber.alertsNow([]);

      await subscriber.deliver('insights.watch-stations-after-line-changed', {
        kind: LINE_CHANGED,
        lineId: 'line_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        stationIds: ['station_1'],
      });

      expect(subscriber.alertStates.raised.map((each) => each.kind)).toEqual([
        'station-alert.fired',
        'station-alert.resolved',
      ]);
    });

    it('watches nothing at a station with no alerts', async () => {
      const subscriber = subscribed();
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));

      await watched(subscriber, 'run_1');

      expect(subscriber.alertStates.stored.size).toBe(0);
    });

    it('fires no alert for a run whose task was deleted, and deletes the alerts a deleted task fired', async () => {
      const subscriber = subscribed([FAILING_ABOVE_HALF]);
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));
      await watched(subscriber, 'run_1');

      await subscriber.deliver('insights.delete-alerts-of-deleted-task', {
        kind: TASK_DELETED,
        taskId: 'task_1',
        workspaceId: 'ws_1',
      });
      await watched(subscriber, 'run_1');

      expect(
        (
          await subscriber.alertStates.of(StationId.of('station_1'))
        )?.firings.map((each) => each.taskId.value),
      ).toEqual([]);
    });
  });
});
