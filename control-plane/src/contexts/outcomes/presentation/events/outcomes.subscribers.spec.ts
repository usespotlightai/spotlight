import { deletionsInMemory } from '@outcomes/application/ports/deletions.fake-spec';
import { pendingReviewsInMemory } from '@outcomes/application/ports/pending-reviews.fake-spec';
import { stationConfigPullRequestsInMemory } from '@outcomes/application/ports/station-config-pull-requests.fake-spec';
import type { EndedRun } from '@outcomes/application/ports/work.port';
import { AlertInbox } from '@outcomes/application/services/alert-inbox.service';
import { DeleteOutcomes } from '@outcomes/application/services/delete-outcomes.service';
import { GradeAsides } from '@outcomes/application/services/grade-asides.service';
import { NoteChangeChecked } from '@outcomes/application/services/note-change-checked.service';
import { NoteChangeShaped } from '@outcomes/application/services/note-change-shaped.service';
import { NoteChatStarted } from '@outcomes/application/services/note-chat-started.service';
import { NoteConfigPullRequestOpened } from '@outcomes/application/services/note-config-pull-request-opened.service';
import { NotePersonAct } from '@outcomes/application/services/note-person-act.service';
import { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import { NotePullRequestRecords } from '@outcomes/application/services/note-pull-request-records.service';
import { NotePullRequestReviewed } from '@outcomes/application/services/note-pull-request-reviewed.service';
import { NoteRunDigested } from '@outcomes/application/services/note-run-digested.service';
import { NoteRunEnded } from '@outcomes/application/services/note-run-ended.service';
import { NoteRunMemories } from '@outcomes/application/services/note-run-memories.service';
import { NoteRunPassed } from '@outcomes/application/services/note-run-passed.service';
import { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import { NoteTaskFailed } from '@outcomes/application/services/note-task-failed.service';
import { NoteTaskTouch } from '@outcomes/application/services/note-task-touch.service';
import { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import { RequestJudging } from '@outcomes/application/services/request-judging.service';
import { WatchStations } from '@outcomes/application/services/watch-stations.service';
import { StationWatchesInMemory } from '@outcomes/domain/alerts.fake-spec';
import { RunJudged } from '@outcomes/domain/events/run-judged.event';
import { RunRecordEnded } from '@outcomes/domain/events/run-record-ended.event';
import {
  ChatRecordsInMemory,
  TaskFailuresInMemory,
  TaskTouchesInMemory,
} from '@outcomes/domain/insights.fake-spec';
import {
  ChangeJudgingsInMemory,
  JudgingsInMemory,
  judgeScore,
  PairJudgingsInMemory,
  queuedJudging,
  RUBRIC_VERSION,
  reasonOf,
  ScoresInMemory,
} from '@outcomes/domain/judging.fake-spec';
import {
  endedRecord,
  FIRST_CONFIG,
  inTransaction,
  RunRecordsInMemory,
  SET_UP,
  TaskDeliveriesInMemory,
} from '@outcomes/domain/outcomes.fake-spec';
import {
  PullRequestRecordsInMemory,
  TaskChangeShapesInMemory,
} from '@outcomes/domain/pull-requests.fake-spec';
import { AlertRule } from '@outcomes/domain/value-objects/alert-rule.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import { outcomesSubscribers } from '@outcomes/presentation/events/outcomes.subscribers';
import { CHANGE_CHECKED } from '@shared-kernel/application/integration-events/change-checked.integration-event';
import { CHANGE_STACK_READY } from '@shared-kernel/application/integration-events/change-stack-ready.integration-event';
import { CHAT_STARTED } from '@shared-kernel/application/integration-events/chat-started.integration-event';
import { CONFIG_PULL_REQUEST_OPENED } from '@shared-kernel/application/integration-events/config-pull-request-opened.integration-event';
import { LINE_CHANGED } from '@shared-kernel/application/integration-events/line-changed.integration-event';
import { MEMORIES_USED } from '@shared-kernel/application/integration-events/memories-used.integration-event';
import { PULL_REQUEST_CLOSED } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import { PULL_REQUEST_OPENED } from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import { PULL_REQUEST_PURGED } from '@shared-kernel/application/integration-events/pull-request-purged.integration-event';
import { PULL_REQUEST_RECORDED } from '@shared-kernel/application/integration-events/pull-request-recorded.integration-event';
import { PULL_REQUEST_REVIEW_TAKEN } from '@shared-kernel/application/integration-events/pull-request-review-taken.integration-event';
import { PULL_REQUEST_REVIEWED } from '@shared-kernel/application/integration-events/pull-request-reviewed.integration-event';
import { RUN_DIGESTED } from '@shared-kernel/application/integration-events/run-digested.integration-event';
import { RUN_ENDED } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { RUN_SUPERSEDED } from '@shared-kernel/application/integration-events/run-superseded.integration-event';
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
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const PULL = 'https://github.com/acme/api/pull/3';

const ENDED: EndedRun = {
  runId: 'run_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
  taskId: 'task_1',
  fingerprint: FIRST_CONFIG,
  round: 1,
  ...SET_UP,
  endedAt: new Date('2026-09-30T10:00:00.000Z'),
};

const WORK = {
  endedRun: async (runId: string) => (runId === ENDED.runId ? ENDED : null),
  configsInOrder: async () => [],
  teamRepositories: async () => ['acme/api'],
  teamSkillKeys: async () => [],
  alertsAt: async () => null,
};

const CLOCK = {
  now: () => new Date('2026-09-30T10:05:00.000Z'),
  sleep: async () => {},
};

const subscribed = (alerts: readonly AlertRule[] | null = null) => {
  const records = new RunRecordsInMemory();
  const watches = new StationWatchesInMemory();
  const alerted: string[] = [];
  let alertsNow = alerts;
  const work = { ...WORK, alertsAt: async () => alertsNow };
  const deliveries = new TaskDeliveriesInMemory();
  const judgings = new JudgingsInMemory();
  const scores = new ScoresInMemory();
  const touches = new TaskTouchesInMemory();
  const failures = new TaskFailuresInMemory();
  const chats = new ChatRecordsInMemory();
  const pullRequests = new PullRequestRecordsInMemory();
  const shapes = new TaskChangeShapesInMemory();
  const reviews = pendingReviewsInMemory();
  const configPullRequests = stationConfigPullRequestsInMemory();
  const deletions = deletionsInMemory();
  const asked: string[] = [];
  let next = 0;
  const subscribers = outcomesSubscribers({
    ending: new NoteRunEnded(WORK, records, deletions, inTransaction, {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }),
    superseding: new NoteRunSuperseded(records, deletions, inTransaction, {
      now: () => RECEIVED_AT,
      sleep: async () => {},
    }),
    checking: new NoteChangeChecked(records, deletions, inTransaction, {
      now: () => RECEIVED_AT,
      sleep: async () => {},
    }),
    acting: new NotePersonAct(WORK, records, deletions, inTransaction),
    opening: new NotePullRequestOpened(
      deliveries,
      reviews,
      deletions,
      inTransaction,
      CLOCK,
    ),
    closing: new NotePullRequestClosed(deliveries, inTransaction),
    deleting: new DeleteOutcomes(
      {
        records,
        deliveries,
        judgings,
        changeJudgings: new ChangeJudgingsInMemory(),
        pairJudgings: new PairJudgingsInMemory(),
        scores,
        touches,
        failures,
        chats,
        pullRequests,
        shapes,
        watches,
        reviews,
        configPullRequests,
        deletions,
      },
      inTransaction,
    ),
    judging: new RequestJudging(
      WORK,
      {
        hasTask: async () => true,
        of: async () => null,
        judgesOnTeam: async () => new Map(),
        judgeAt: async () => ({
          teamId: 'team_1',
          lineId: 'line_1',
          rubric: 'Did the run retry uploads?',
          rubricVersion: RUBRIC_VERSION,
          claims: [],
          passShare: 1,
          sample: 1,
          trust: 0.6,
        }),
      },
      {
        available: true,
        model: 'some/model',
        judge: async () => ({
          verdict: { value: true, reasons: [] },
          usage: null,
        }),
      },
      judgings,
      deletions,
      inTransaction,
      CLOCK,
    ),
    scoring: new RecordJudgeScore(judgings, scores, inTransaction, {
      generate: () => {
        next += 1;
        return `score_${next}`;
      },
    }),
    grading: new GradeAsides({
      ask: async (taskId, runId) => {
        asked.push(`ask ${taskId.value} ${runId.value}`);
      },
      resolve: async (taskId, runId) => {
        asked.push(`resolve ${taskId.value} ${runId.value}`);
      },
    }),
    digesting: new NoteRunDigested(WORK, records, deletions, inTransaction),
    remembering: new NoteRunMemories(WORK, records, deletions, inTransaction),
    passing: new NoteRunPassed(records, deletions, inTransaction),
    reviewing: new NotePullRequestReviewed(
      deliveries,
      reviews,
      deletions,
      inTransaction,
      CLOCK,
    ),
    failing: new NoteTaskFailed(failures, deletions, inTransaction),
    touching: new NoteTaskTouch(touches, deletions, inTransaction),
    chatting: new NoteChatStarted(chats, deletions, inTransaction),
    recording: new NotePullRequestRecords(
      pullRequests,
      deletions,
      inTransaction,
    ),
    shaping: new NoteChangeShaped(WORK, shapes, deletions, inTransaction),
    watching: new WatchStations(
      work,
      { records, deliveries, watches, deletions },
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
      watches,
    ),
    openingConfigPullRequests: new NoteConfigPullRequestOpened(
      configPullRequests,
      deletions,
      inTransaction,
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
    deliveries,
    judgings,
    scores,
    touches,
    failures,
    chats,
    pullRequests,
    shapes,
    watches,
    reviews,
    configPullRequests,
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

describe('outcomesSubscribers', () => {
  it('names every subscriber within the context', () => {
    const { subscribers } = subscribed();

    expect(subscribers.every((each) => each.name.startsWith('outcomes.'))).toBe(
      true,
    );
    expect(new Set(subscribers.map((each) => each.name)).size).toBe(
      subscribers.length,
    );
  });

  it('records a run that ended at a station', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('outcomes.record-ended-run', runEnded());

    expect((await subscriber.record())?.ending).toBe('completed');
  });

  it('records a run a person stopped as stopped', async () => {
    const subscriber = subscribed();

    await subscriber.deliver(
      'outcomes.record-ended-run',
      runEnded({ stopped: true }),
    );

    expect((await subscriber.record())?.ending).toBe('stopped');
  });

  it('records nothing for a run at no station', async () => {
    const subscriber = subscribed();

    await subscriber.deliver(
      'outcomes.record-ended-run',
      runEnded({ stationId: null }),
    );

    expect(await subscriber.record()).toBeNull();
  });

  it('records nothing for a change checked for no task, as a replay’s is', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('outcomes.record-checked-change', {
      kind: CHANGE_CHECKED,
      runId: 'run_1',
      taskId: null,
      workspaceId: 'ws_1',
      passed: true,
    });

    expect(await subscriber.record()).toBeNull();
  });

  it('fills in the checks, the next act and the superseding in any order', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('outcomes.record-checked-change', {
      kind: CHANGE_CHECKED,
      runId: 'run_1',
      taskId: 'task_1',
      workspaceId: 'ws_1',
      passed: true,
    });
    await subscriber.deliver('outcomes.record-next-person-act', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      act: 'sent-back',
      by: 'user_ada',
      after: 'run_1',
      at: '2026-09-30T11:00:00.000Z',
      tool: null,
      server: null,
    });
    await subscriber.deliver('outcomes.record-superseded-run', {
      kind: RUN_SUPERSEDED,
      runId: 'run_1',
      workspaceId: 'ws_1',
      taskId: 'task_1',
    });
    await subscriber.deliver('outcomes.record-ended-run', runEnded());

    const record = await subscriber.record();
    expect(record?.checks).toBe('passed');
    expect(record?.next?.act).toBe('sent-back');
    expect(record?.ending).toBe('superseded');
  });

  it('follows the task’s pull request from opened to merged', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('outcomes.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });
    await subscriber.deliver('outcomes.record-closed-pull-request', {
      kind: PULL_REQUEST_CLOSED,
      workspaceId: 'ws_1',
      pullRequest: PULL,
      repository: 'acme/api',
      closedAt: '2026-09-30T12:00:00.000Z',
      merged: true,
      mergeCommit: 'abc123',
    });

    expect(
      (await subscriber.deliveries.forTask(TaskId.of('task_1')))?.state,
    ).toBe('merged');
  });

  it('keeps what a run cost and where it passed its task, received before or after it ended', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('outcomes.record-run-cost', {
      kind: RUN_DIGESTED,
      runId: 'run_1',
      workspaceId: 'ws_1',
      taskId: 'task_1',
      ms: 60_000,
      steps: 12,
      faults: 1,
      changedLines: 40,
      used: 40_000,
      size: 200_000,
      cost: 0.42,
      currency: 'USD',
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
    await subscriber.deliver('outcomes.record-ended-run', runEnded());
    await subscriber.deliver('outcomes.record-passed-run', {
      kind: TASK_PASSED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      runId: 'run_1',
      from: 'station_1',
      to: 'station_2',
      at: '2026-09-30T10:01:00.000Z',
    });

    const record = await subscriber.record();
    expect(record?.cost?.spend).toEqual({ amount: 0.42, currency: 'USD' });
    expect(record?.cost?.tokens).toEqual({
      input: 1_200,
      output: 900,
      cacheRead: 80_000,
      cacheWrite: null,
    });
    expect(record?.passed?.to).toBe('station_2');
    expect(record?.end?.setup.harness).toBe('claude-code');
    expect(record?.tools?.callsTo('linear')?.latency).toEqual(
      LatencyHistogram.timing([300, 900]),
    );
    expect(record?.tools?.read('grafana')).toBe(true);
  });

  it('keeps no cost for a run that worked no task', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('outcomes.record-run-cost', {
      kind: RUN_DIGESTED,
      runId: 'run_1',
      workspaceId: 'ws_1',
      taskId: null,
      ms: 60_000,
      steps: 12,
      faults: 1,
      changedLines: 0,
      used: null,
      size: null,
      cost: 0.42,
      currency: 'USD',
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
    const used = (way: string, memories: readonly string[]) =>
      subscriber.deliver('outcomes.record-run-memories', {
        kind: MEMORIES_USED,
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId: 'task_1',
        way,
        memories,
      });

    await used('briefed', ['mem_1']);
    await subscriber.deliver('outcomes.record-ended-run', runEnded());
    await used('recalled', ['mem_2']);

    expect((await subscriber.record())?.hasEnded).toBe(true);
    expect((await subscriber.record())?.memories).toMatchObject({
      briefed: ['mem_1'],
      recalled: ['mem_2'],
    });
  });

  it('keeps no memories for a run that worked no task, nor for a way it does not know', async () => {
    const subscriber = subscribed();
    const used = (taskId: string | null, way: string) =>
      subscriber.deliver('outcomes.record-run-memories', {
        kind: MEMORIES_USED,
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId,
        way,
        memories: ['mem_1'],
      });

    await used(null, 'briefed');
    await used('task_1', 'unknown');

    expect(await subscriber.record()).toBeNull();
  });

  it('dates a pull request’s first review by a person, never a bot’s', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });
    const reviewed = (byBot: boolean, submittedAt: string) =>
      subscriber.deliver('outcomes.record-first-review', {
        kind: PULL_REQUEST_REVIEWED,
        workspaceId: 'ws_1',
        pullRequest: PULL,
        state: 'commented',
        login: byBot ? 'spotlight[bot]' : 'ada',
        byBot,
        submittedAt,
      });

    await reviewed(true, '2026-09-30T10:40:00.000Z');
    await reviewed(false, '2026-09-30T11:00:00.000Z');
    await reviewed(false, '2026-09-30T12:00:00.000Z');

    expect(
      (await subscriber.deliveries.forTask(TaskId.of('task_1')))?.firstReviewAt,
    ).toEqual(new Date('2026-09-30T11:00:00.000Z'));
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
      'outcomes.record-task-failure',
      failed(1, '2026-09-30T10:00:00.000Z'),
    );
    await subscriber.deliver(
      'outcomes.record-task-failure',
      failed(2, '2026-09-30T10:01:00.000Z'),
    );
    await subscriber.deliver(
      'outcomes.record-task-failure',
      failed(2, '2026-09-30T10:01:00.000Z'),
    );

    const failures = await subscriber.failures.of(TaskId.of('task_1'));
    expect(failures?.occurrences.map((each) => each.occurrences)).toEqual([
      1, 2,
    ]);
  });

  it('keeps who opened a task, what it asked of people and what they did', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('outcomes.record-inbox-ask', {
      kind: TASK_ASKED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      at: '2026-09-30T10:10:00.000Z',
    });
    await subscriber.deliver('outcomes.record-task-opening', {
      kind: TASK_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_0',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    await subscriber.deliver('outcomes.record-person-touch', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      act: 'answered',
      by: 'user_bob',
      after: 'run_1',
      at: '2026-09-30T10:20:00.000Z',
      tool: null,
      server: null,
    });

    const touches = await subscriber.touches.of(TaskId.of('task_1'));
    expect(touches?.opening?.by?.value).toBe('user_ada');
    expect(touches?.waits()).toEqual([
      {
        stationId: 'station_1',
        askedAt: new Date('2026-09-30T10:10:00.000Z'),
        answeredAt: new Date('2026-09-30T10:20:00.000Z'),
        answeredBy: 'user_bob',
      },
    ]);
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

    await subscriber.deliver('outcomes.record-started-chat', started);
    await subscriber.deliver('outcomes.record-started-chat', started);

    expect(subscriber.chats.stored.size).toBe(1);
  });

  it('keeps the config pull requests Spotlight opened, each once, until their team is deleted and after none received late', async () => {
    const subscriber = subscribed();
    const opened = (id: string, teamId = 'team_1') => ({
      kind: CONFIG_PULL_REQUEST_OPENED,
      configPullRequestId: id,
      workspaceId: 'ws_1',
      teamId,
      stationId: 'station_1',
      fingerprint: FIRST_CONFIG,
      url: `https://github.com/acme/platform/pull/${id}`,
      at: '2026-09-30T09:00:00.000Z',
    });

    await subscriber.deliver(
      'outcomes.record-opened-config-pull-request',
      opened('1'),
    );
    await subscriber.deliver(
      'outcomes.record-opened-config-pull-request',
      opened('1'),
    );
    await subscriber.deliver(
      'outcomes.record-opened-config-pull-request',
      opened('2', 'team_2'),
    );

    expect([...subscriber.configPullRequests.stored.keys()]).toEqual([
      '1',
      '2',
    ]);

    await subscriber.deliver(
      'outcomes.delete-config-pull-requests-of-deleted-team',
      {
        kind: TEAM_DELETED,
        workspaceId: 'ws_1',
        teamId: 'team_1',
        key: 'core',
      },
    );
    await subscriber.deliver(
      'outcomes.record-opened-config-pull-request',
      opened('3'),
    );

    expect([...subscriber.configPullRequests.stored.keys()]).toEqual(['2']);

    await subscriber.deliver(
      'outcomes.delete-config-pull-requests-of-deleted-workspace',
      { kind: WORKSPACE_DELETED, workspaceId: 'ws_1', slug: 'acme' },
    );

    expect(subscriber.configPullRequests.stored.size).toBe(0);
  });

  it('deletes the touches and failures of a deleted task, and the chats of a deleted workspace', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.record-inbox-ask', {
      kind: TASK_ASKED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      at: '2026-09-30T10:10:00.000Z',
    });
    await subscriber.deliver('outcomes.record-task-failure', {
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
    await subscriber.deliver('outcomes.record-started-chat', {
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
      'outcomes.delete-touches-of-deleted-task',
      deleted,
    );
    await subscriber.deliver(
      'outcomes.delete-failures-of-deleted-task',
      deleted,
    );
    await subscriber.deliver('outcomes.delete-chats-of-deleted-workspace', {
      kind: WORKSPACE_DELETED,
      workspaceId: 'ws_1',
      slug: 'acme',
    });

    expect(subscriber.touches.stored.size).toBe(0);
    expect(subscriber.failures.stored.size).toBe(0);
    expect(subscriber.chats.stored.size).toBe(0);
  });

  it('deletes the runs and delivery of a deleted task', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.record-ended-run', runEnded());
    await subscriber.deliver('outcomes.record-opened-pull-request', {
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

    await subscriber.deliver('outcomes.delete-runs-of-deleted-task', deleted);
    await subscriber.deliver(
      'outcomes.delete-delivery-of-deleted-task',
      deleted,
    );

    expect(await subscriber.record()).toBeNull();
    expect(subscriber.deliveries.stored.size).toBe(0);
  });

  it('deletes the runs of a deleted team', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.record-ended-run', runEnded());

    await subscriber.deliver('outcomes.delete-runs-of-deleted-team', {
      kind: TEAM_DELETED,
      workspaceId: 'ws_1',
      teamId: 'team_1',
      key: 'core',
    });

    expect(await subscriber.record()).toBeNull();
  });

  it('dates a pull request’s first review even when the review is received before the opening', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.record-first-review', {
      kind: PULL_REQUEST_REVIEWED,
      workspaceId: 'ws_1',
      pullRequest: PULL,
      state: 'approved',
      login: 'ada',
      byBot: false,
      submittedAt: '2026-09-30T11:00:00.000Z',
    });

    await subscriber.deliver('outcomes.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });

    expect(
      (await subscriber.deliveries.forTask(TaskId.of('task_1')))?.firstReviewAt,
    ).toEqual(new Date('2026-09-30T11:00:00.000Z'));
    expect(subscriber.reviews.stored.size).toBe(0);
  });

  it('deletes the failures and pull requests of a deleted team', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.record-task-failure', {
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
    await subscriber.deliver('outcomes.record-opened-pull-request', {
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
      'outcomes.delete-failures-of-deleted-team',
      deletedTeam,
    );
    await subscriber.deliver(
      'outcomes.delete-deliveries-of-deleted-team',
      deletedTeam,
    );

    expect(subscriber.failures.stored.size).toBe(0);
    expect(subscriber.deliveries.stored.size).toBe(0);
  });

  it('records nothing more of a task received after it was deleted, whichever deletion came first', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.delete-touches-of-deleted-task', {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    });

    await subscriber.deliver('outcomes.record-ended-run', runEnded());
    await subscriber.deliver('outcomes.record-run-cost', {
      kind: RUN_DIGESTED,
      runId: 'run_1',
      workspaceId: 'ws_1',
      taskId: 'task_1',
      ms: 60_000,
      steps: 12,
      faults: 1,
      changedLines: 0,
      used: null,
      size: null,
      cost: 0.42,
      currency: 'USD',
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      servers: [],
      skillsRead: [],
    });
    await subscriber.deliver('outcomes.record-passed-run', {
      kind: TASK_PASSED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      runId: 'run_2',
      from: 'station_1',
      to: 'station_2',
      at: '2026-09-30T10:01:00.000Z',
    });
    await subscriber.deliver('outcomes.record-checked-change', {
      kind: CHANGE_CHECKED,
      runId: 'run_3',
      workspaceId: 'ws_1',
      taskId: 'task_1',
      passed: true,
    });
    await subscriber.deliver('outcomes.record-superseded-run', {
      kind: RUN_SUPERSEDED,
      runId: 'run_4',
      workspaceId: 'ws_1',
      taskId: 'task_1',
    });
    await subscriber.deliver('outcomes.record-next-person-act', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      act: 'answered',
      by: 'user_bob',
      after: 'run_5',
      at: '2026-09-30T10:20:00.000Z',
      tool: null,
      server: null,
    });
    await subscriber.deliver('outcomes.record-inbox-ask', {
      kind: TASK_ASKED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      at: '2026-09-30T10:10:00.000Z',
    });
    await subscriber.deliver('outcomes.record-task-failure', {
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
    await subscriber.deliver('outcomes.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      url: PULL,
      at: '2026-09-30T10:30:00.000Z',
    });

    expect(subscriber.records.stored.size).toBe(0);
    expect(subscriber.touches.stored.size).toBe(0);
    expect(subscriber.failures.stored.size).toBe(0);
    expect(subscriber.deliveries.stored.size).toBe(0);
  });

  it('records nothing more of a team received after it was deleted, and lets go of what it received before it knew the team', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.record-inbox-ask', {
      kind: TASK_ASKED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      stationId: 'station_1',
      at: '2026-09-30T10:10:00.000Z',
    });
    await subscriber.deliver('outcomes.delete-chats-of-deleted-team', {
      kind: TEAM_DELETED,
      workspaceId: 'ws_1',
      teamId: 'team_1',
      key: 'core',
    });

    await subscriber.deliver('outcomes.record-ended-run', runEnded());
    await subscriber.deliver('outcomes.record-started-chat', {
      kind: CHAT_STARTED,
      chatId: 'chat_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    await subscriber.deliver('outcomes.record-task-opening', {
      kind: TASK_OPENED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_0',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    await subscriber.deliver('outcomes.record-task-failure', {
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
    expect(subscriber.touches.stored.size).toBe(0);
    expect(subscriber.failures.stored.size).toBe(0);
  });

  it('records nothing more of a workspace received after it was deleted', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.delete-chats-of-deleted-workspace', {
      kind: WORKSPACE_DELETED,
      workspaceId: 'ws_1',
      slug: 'acme',
    });

    await subscriber.deliver('outcomes.record-ended-run', runEnded());
    await subscriber.deliver('outcomes.record-started-chat', {
      kind: CHAT_STARTED,
      chatId: 'chat_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    await subscriber.deliver('outcomes.record-task-opening', {
      kind: TASK_OPENED,
      taskId: 'task_2',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_0',
      by: 'user_ada',
      at: '2026-09-30T09:00:00.000Z',
    });
    await subscriber.deliver('outcomes.record-first-review', {
      kind: PULL_REQUEST_REVIEWED,
      workspaceId: 'ws_1',
      pullRequest: PULL,
      state: 'approved',
      login: 'ada',
      byBot: false,
      submittedAt: '2026-09-30T11:00:00.000Z',
    });

    expect(subscriber.records.stored.size).toBe(0);
    expect(subscriber.chats.stored.size).toBe(0);
    expect(subscriber.touches.stored.size).toBe(0);
    expect(subscriber.reviews.stored.size).toBe(0);
  });

  it('deletes everything of a deleted workspace', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.record-ended-run', runEnded());
    await subscriber.deliver('outcomes.record-opened-pull-request', {
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
      'outcomes.delete-runs-of-deleted-workspace',
      deletedWorkspace,
    );
    await subscriber.deliver(
      'outcomes.delete-deliveries-of-deleted-workspace',
      deletedWorkspace,
    );

    expect(subscriber.records.stored.size).toBe(0);
    expect(subscriber.deliveries.stored.size).toBe(0);
  });

  it('requests a judge’s verdict on a run that ended at a judged station', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('outcomes.judge-ended-run', runEnded());
    await subscriber.deliver('outcomes.judge-ended-run', runEnded());

    const judging = await subscriber.judgings.of(RunId.of('run_1'));
    expect(judging?.hasPendingJob).toBe(true);
    expect(judging?.rubric.version).toBe(RUBRIC_VERSION);
    expect(subscriber.judgings.stored.size).toBe(1);
  });

  it('judges neither a cancelled run nor one at no station', async () => {
    const subscriber = subscribed();

    await subscriber.deliver(
      'outcomes.judge-ended-run',
      runEnded({ outcome: 'cancelled' }),
    );
    await subscriber.deliver(
      'outcomes.judge-ended-run',
      runEnded({ stationId: null }),
    );

    expect(subscriber.judgings.stored.size).toBe(0);
  });

  it('records the judge’s score once, however often the verdict is received', async () => {
    const subscriber = subscribed();
    const judged = new RunJudged(
      RunId.of('run_1'),
      queuedJudging().workspaceId,
      queuedJudging().place,
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

    await subscriber.deliver('outcomes.judge-ended-run', runEnded());
    await subscriber.deliver('outcomes.record-judge-score', judged as never);
    await subscriber.deliver('outcomes.record-judge-score', judged as never);

    const [score, ...rest] = [...subscriber.scores.stored.values()];
    expect(rest).toEqual([]);
    expect(score?.source).toBe('judge');
    expect(score?.value).toBe(1);
  });

  it('requests no judging of a run whose end is received after its task was deleted', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.delete-runs-of-deleted-task', {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
    });

    await subscriber.deliver('outcomes.judge-ended-run', runEnded());

    expect(subscriber.judgings.stored.size).toBe(0);
  });

  it('records no score for a verdict received after its task was deleted', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.judge-ended-run', runEnded());
    await subscriber.deliver(
      'outcomes.delete-judgings-and-scores-of-deleted-task',
      {
        kind: TASK_DELETED,
        taskId: 'task_1',
        workspaceId: 'ws_1',
      },
    );

    await subscriber.deliver(
      'outcomes.record-judge-score',
      new RunJudged(
        RunId.of('run_1'),
        queuedJudging().workspaceId,
        queuedJudging().place,
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

  it('resolves a run’s grade aside once a person grades it', async () => {
    const subscriber = subscribed();

    await subscriber.deliver('outcomes.ask-or-resolve-grade', {
      kind: 'score.recorded',
      scoreId: 'score_1',
      runId: RunId.of('run_1'),
      place: queuedJudging().place,
      source: 'person',
    } as never);

    expect(subscriber.asked).toEqual(['resolve task_1 run_1']);
  });

  it('deletes the judgings and scores of a deleted task together', async () => {
    const subscriber = subscribed();
    await subscriber.deliver('outcomes.judge-ended-run', runEnded());
    await subscriber.scores.add(
      judgeScore('run_1', ScoreScale.yesNo(), 1, { taskId: 'task_1' }),
    );

    await subscriber.deliver(
      'outcomes.delete-judgings-and-scores-of-deleted-task',
      {
        kind: TASK_DELETED,
        taskId: 'task_1',
        workspaceId: 'ws_1',
      },
    );

    expect(subscriber.judgings.stored.size).toBe(0);
    expect(subscriber.scores.stored.size).toBe(0);
  });

  describe('every pull request in the team’s repositories', () => {
    const recordedEvent = (change: Record<string, unknown> = {}) => ({
      kind: PULL_REQUEST_RECORDED,
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
      draftSpells: [],
      firstReviewAt: null,
      firstUnblockingReviewAt: null,
      firstApprovedAt: null,
      humanReviewedAt: [],
      reviews: 0,
      reviewRounds: 0,
      reviewComments: 0,
      botActivity: [],
      isRevert: false,
      revertedBy: null,
      version: 1,
      ...change,
    });

    const recordOf = (subscriber: ReturnType<typeof subscribed>) =>
      subscriber.pullRequests.at(
        WorkspaceId.of('ws_1'),
        PullRequestUrl.of(PULL),
      );

    it('records a pull request no task owns, as people’s', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent(),
      );

      const record = await recordOf(subscriber);
      expect(record?.seen?.title).toBe('Retry failed uploads');
      expect(record?.owner).toBeNull();
    });

    it('records when it was ready for review, reviewed, approved, and what bots did on it', async () => {
      const subscriber = subscribed();
      const botActivity = [
        {
          login: 'coderabbitai[bot]',
          reviews: 1,
          comments: 4,
          threads: 2,
          resolvedThreads: 1,
        },
      ];

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent({
          readyForReviewAt: '2026-09-30T09:00:00.000Z',
          draftSpells: [
            {
              from: '2026-09-30T09:20:00.000Z',
              to: '2026-09-30T09:25:00.000Z',
            },
            { from: '2026-09-30T11:00:00.000Z', to: null },
          ],
          firstUnblockingReviewAt: '2026-09-30T09:10:00.000Z',
          firstApprovedAt: '2026-09-30T10:00:00.000Z',
          humanReviewedAt: [
            '2026-09-30T09:30:00.000Z',
            '2026-09-30T10:00:00.000Z',
          ],
          botActivity,
        }),
      );

      expect((await recordOf(subscriber))?.seen).toMatchObject({
        readyForReviewAt: new Date('2026-09-30T09:00:00.000Z'),
        draftSpells: [
          {
            from: new Date('2026-09-30T09:20:00.000Z'),
            to: new Date('2026-09-30T09:25:00.000Z'),
          },
          { from: new Date('2026-09-30T11:00:00.000Z'), to: null },
        ],
        firstUnblockingReviewAt: new Date('2026-09-30T09:10:00.000Z'),
        firstApprovedAt: new Date('2026-09-30T10:00:00.000Z'),
        humanReviewedAt: [
          new Date('2026-09-30T09:30:00.000Z'),
          new Date('2026-09-30T10:00:00.000Z'),
        ],
        botActivity,
      });
    });

    it('makes it Spotlight’s whichever it receives first, the pull request or the task opening it', async () => {
      const subscriber = subscribed();

      await subscriber.deliver('outcomes.record-pull-request-owner', {
        kind: PULL_REQUEST_OPENED,
        taskId: 'task_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        url: PULL,
        at: '2026-09-30T08:00:00.000Z',
      });
      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent(),
      );

      const record = await recordOf(subscriber);
      expect(record?.owner?.taskId.value).toBe('task_1');
      expect(record?.seen?.number).toBe(3);
    });

    it('keeps the newest of what GitHub said, however late an older word arrives', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent({ state: 'merged', version: 4 }),
      );
      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent({ state: 'open', version: 2 }),
      );

      expect((await recordOf(subscriber))?.seen?.state).toBe('merged');
    });

    it('marks people’s pull request touched once a review task ran on it', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent(),
      );
      await subscriber.deliver('outcomes.record-pull-request-review-task', {
        kind: PULL_REQUEST_REVIEW_TAKEN,
        taskId: 'task_9',
        workspaceId: 'ws_1',
        url: PULL,
      });

      expect(
        (await recordOf(subscriber))?.reviewTasks.map((each) => each.value),
      ).toEqual(['task_9']);
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

    it('deletes people’s pull request once GitHub purges it, and never takes it back from a late word', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        closedEvent(),
      );
      await subscriber.deliver(
        'outcomes.delete-pull-request-purged-by-github',
        purgedEvent(),
      );
      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        closedEvent({ version: 3 }),
      );

      expect(await recordOf(subscriber)).toBeNull();
    });

    it('turns away a late word GitHub said no later than it purged it, even one saying it is open', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        closedEvent(),
      );
      await subscriber.deliver(
        'outcomes.delete-pull-request-purged-by-github',
        purgedEvent(),
      );
      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent({ updatedAt: CLOSED_AT, version: 9 }),
      );

      expect(await recordOf(subscriber)).toBeNull();
    });

    it('takes a purged pull request back once GitHub changes it later, at any version', async () => {
      const reopened = subscribed();
      const closedLater = subscribed();

      for (const subscriber of [reopened, closedLater]) {
        await subscriber.deliver(
          'outcomes.record-seen-pull-request',
          closedEvent(),
        );
        await subscriber.deliver(
          'outcomes.delete-pull-request-purged-by-github',
          purgedEvent(),
        );
      }
      await reopened.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent({ title: 'Reopened' }),
      );
      await closedLater.deliver(
        'outcomes.record-seen-pull-request',
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
        'outcomes.record-seen-pull-request',
        closedEvent({ version: 5 }),
      );
      await subscriber.deliver(
        'outcomes.record-pull-request-owner',
        ownedEvent(),
      );
      await subscriber.deliver(
        'outcomes.delete-pull-request-purged-by-github',
        purgedEvent(),
      );

      expect((await recordOf(subscriber))?.seen?.number).toBe(3);

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent({ title: 'Reopened', version: 1 }),
      );

      expect((await recordOf(subscriber))?.seen?.title).toBe('Reopened');
    });

    it('lets go of a deleted task’s pull request GitHub already purged', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        closedEvent(),
      );
      await subscriber.deliver(
        'outcomes.record-pull-request-owner',
        ownedEvent(),
      );
      await subscriber.deliver(
        'outcomes.delete-pull-request-purged-by-github',
        purgedEvent(),
      );
      await subscriber.deliver(
        'outcomes.delete-pull-requests-of-deleted-task',
        {
          kind: TASK_DELETED,
          taskId: 'task_1',
          workspaceId: 'ws_1',
        },
      );

      expect(await recordOf(subscriber)).toBeNull();
    });

    it('keeps what GitHub said of a deleted team’s pull request, as nobody’s', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent(),
      );
      await subscriber.deliver(
        'outcomes.record-pull-request-owner',
        ownedEvent(),
      );
      await subscriber.deliver(
        'outcomes.delete-pull-requests-of-deleted-team',
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

    it('lets go of a deleted team’s pull request GitHub already purged', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        closedEvent(),
      );
      await subscriber.deliver(
        'outcomes.record-pull-request-owner',
        ownedEvent(),
      );
      await subscriber.deliver(
        'outcomes.delete-pull-request-purged-by-github',
        purgedEvent(),
      );
      await subscriber.deliver(
        'outcomes.delete-pull-requests-of-deleted-team',
        {
          kind: TEAM_DELETED,
          workspaceId: 'ws_1',
          teamId: 'team_1',
        },
      );

      expect(await recordOf(subscriber)).toBeNull();
    });

    it('leaves another team’s pull request alone when a team is deleted', async () => {
      const subscriber = subscribed();

      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent(),
      );
      await subscriber.deliver(
        'outcomes.record-pull-request-owner',
        ownedEvent('task_1', 'team_2'),
      );
      await subscriber.deliver(
        'outcomes.delete-pull-requests-of-deleted-team',
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
        'outcomes.record-seen-pull-request',
        recordedEvent(),
      );
      await subscriber.deliver('outcomes.record-pull-request-owner', {
        kind: PULL_REQUEST_OPENED,
        taskId: 'task_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        url: PULL,
        at: '2026-09-30T08:00:00.000Z',
      });
      await subscriber.deliver(
        'outcomes.delete-pull-requests-of-deleted-task',
        {
          kind: TASK_DELETED,
          taskId: 'task_1',
          workspaceId: 'ws_1',
        },
      );
      await subscriber.deliver('outcomes.record-pull-request-owner', {
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
        'outcomes.record-seen-pull-request',
        recordedEvent(),
      );
      await subscriber.deliver(
        'outcomes.delete-pull-requests-of-deleted-workspace',
        {
          kind: WORKSPACE_DELETED,
          workspaceId: 'ws_1',
        },
      );
      await subscriber.deliver(
        'outcomes.record-seen-pull-request',
        recordedEvent(),
      );

      expect(await recordOf(subscriber)).toBeNull();
    });

    it('records no cohorts a change stack claims for another task or workspace than its run’s', async () => {
      const subscriber = subscribed();

      await subscriber.deliver('outcomes.record-change-shape', {
        kind: CHANGE_STACK_READY,
        runId: 'run_1',
        taskId: 'task_2',
        workspaceId: 'ws_1',
        changeTitles: ['Fix the retry loop'],
        changeIntents: [''],
        at: '2026-09-30T10:00:00.000Z',
      });
      await subscriber.deliver('outcomes.record-change-shape', {
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

      await subscriber.deliver('outcomes.record-change-shape', {
        kind: CHANGE_STACK_READY,
        runId: 'run_1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        changeTitles: ['Fix the retry loop'],
        changeIntents: ['Stop dropping uploads'],
        at: '2026-09-30T10:00:00.000Z',
      });
      await subscriber.deliver('outcomes.record-change-shape', {
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
        'outcomes.watch-station-after-run',
        new RunRecordEnded(
          record.runId,
          record.workspaceId,
          record.end.place,
        ) as never,
      );
    };

    it('raises one inbox aside on the run that crossed a station’s alert, and resolves it once the station recovers', async () => {
      const subscriber = subscribed([FAILING_ABOVE_HALF]);
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));

      await watched(subscriber, 'run_1');
      await watched(subscriber, 'run_1');
      const [raised] = subscriber.watches.raised;
      await subscriber.deliver(
        'outcomes.follow-station-alert-aside',
        raised as never,
      );

      expect(subscriber.alerted).toEqual(['open task_1 alert_1']);

      await subscriber.records.add(
        endedRecord('run_2', {
          taskId: 'task_2',
          endedAt: new Date('2026-09-30T11:00:00.000Z'),
        }),
      );
      await watched(subscriber, 'run_2');
      const recovered = subscriber.watches.raised[1];
      await subscriber.deliver(
        'outcomes.follow-station-alert-aside',
        recovered as never,
      );

      expect(subscriber.alerted).toEqual([
        'open task_1 alert_1',
        'resolve task_1 alert_1',
      ]);
    });

    it('resolves the aside even when the raising is received after the recovery', async () => {
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
      const [raised, recovered] = subscriber.watches.raised;

      await subscriber.deliver(
        'outcomes.follow-station-alert-aside',
        recovered as never,
      );
      await subscriber.deliver(
        'outcomes.follow-station-alert-aside',
        raised as never,
      );

      expect(subscriber.alerted).toEqual([
        'resolve task_1 alert_1',
        'resolve task_1 alert_1',
      ]);
    });

    it('deletes the alerts of a deleted team and raises none for it after', async () => {
      const subscriber = subscribed([FAILING_ABOVE_HALF]);
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));
      await watched(subscriber, 'run_1');

      await subscriber.deliver('outcomes.delete-alerts-of-deleted-team', {
        kind: TEAM_DELETED,
        teamId: 'team_1',
        workspaceId: 'ws_1',
      });
      await watched(subscriber, 'run_1');

      expect(subscriber.watches.stored.size).toBe(0);
    });

    it('re-checks a changed line’s stations, recovering an alert whose threshold is gone', async () => {
      const subscriber = subscribed([FAILING_ABOVE_HALF]);
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));
      await watched(subscriber, 'run_1');
      subscriber.alertsNow([]);

      await subscriber.deliver('outcomes.watch-stations-after-line-changed', {
        kind: LINE_CHANGED,
        lineId: 'line_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        stationIds: ['station_1'],
      });

      expect(subscriber.watches.raised.map((each) => each.kind)).toEqual([
        'station-alert.raised',
        'station-alert.recovered',
      ]);
    });

    it('watches nothing at a station with no alerts', async () => {
      const subscriber = subscribed();
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));

      await watched(subscriber, 'run_1');

      expect(subscriber.watches.stored.size).toBe(0);
    });

    it('raises no alert for a run whose task was deleted, and deletes the alerts a deleted task raised', async () => {
      const subscriber = subscribed([FAILING_ABOVE_HALF]);
      await subscriber.records.add(endedRecord('run_1', { ending: 'failed' }));
      await watched(subscriber, 'run_1');

      await subscriber.deliver('outcomes.delete-alerts-of-deleted-task', {
        kind: TASK_DELETED,
        taskId: 'task_1',
        workspaceId: 'ws_1',
      });
      await watched(subscriber, 'run_1');

      expect(
        (await subscriber.watches.of('station_1'))?.crossings.map(
          (each) => each.taskId.value,
        ),
      ).toEqual([]);
    });
  });
});
