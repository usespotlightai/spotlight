import type {
  ConfigInOrder,
  EndedRun,
  WorkPort,
} from '@insights/application/ports/work.port';
import { ReadStationInsightsHandler } from '@insights/application/queries/handlers/read-station-insights.handler';
import { ReadStationInsightsQuery } from '@insights/application/queries/read-station-insights.query';
import { AlertInbox } from '@insights/application/services/alert-inbox.service';
import { DeleteInsights } from '@insights/application/services/delete-insights.service';
import { GradeInboxRequests } from '@insights/application/services/grade-inbox-requests.service';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { RecordChangeChecks } from '@insights/application/services/record-change-checks.service';
import { RecordChangeShape } from '@insights/application/services/record-change-shape.service';
import { RecordChat } from '@insights/application/services/record-chat.service';
import { RecordConfigPullRequest } from '@insights/application/services/record-config-pull-request.service';
import { RecordHumanAction } from '@insights/application/services/record-human-action.service';
import { RecordJudgeScore } from '@insights/application/services/record-judge-score.service';
import { RecordPullRequestClosing } from '@insights/application/services/record-pull-request-closing.service';
import { RecordPullRequestOpening } from '@insights/application/services/record-pull-request-opening.service';
import { RecordPullRequestReview } from '@insights/application/services/record-pull-request-review.service';
import { RecordPullRequests } from '@insights/application/services/record-pull-requests.service';
import { RecordRunEnding } from '@insights/application/services/record-run-ending.service';
import { RecordRunMemories } from '@insights/application/services/record-run-memories.service';
import { RecordRunUsageSummary } from '@insights/application/services/record-run-usage-summary.service';
import { RecordStationPass } from '@insights/application/services/record-station-pass.service';
import { RecordSupersededRun } from '@insights/application/services/record-superseded-run.service';
import { RecordTaskFailure } from '@insights/application/services/record-task-failure.service';
import { RecordTaskHumanAction } from '@insights/application/services/record-task-human-action.service';
import { RequestJudging } from '@insights/application/services/request-judging.service';
import { RunOutcomes } from '@insights/application/services/run-outcomes.service';
import { WatchStations } from '@insights/application/services/watch-stations.service';
import { RunRecordVersionConflictError } from '@insights/domain/exceptions/run-record-version-conflict.error';
import { lastConfigRunsFrom } from '@insights/domain/runs.fake-spec';
import type { ConfigIntervalBound } from '@insights/domain/services/config-intervals';
import { DrizzleDeletions } from '@insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger';
import { DrizzlePendingReviews } from '@insights/infrastructure/persistence/drizzle/ledgers/pending-reviews.ledger';
import { DrizzleStationConfigPullRequests } from '@insights/infrastructure/persistence/drizzle/ledgers/station-config-pull-requests.ledger';
import { DrizzleRunFactProjection } from '@insights/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { DrizzleChangeJudgingRepository } from '@insights/infrastructure/persistence/drizzle/repositories/change-judging.repository';
import { DrizzleChatRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/chat-record.repository';
import { DrizzleJudgingRepository } from '@insights/infrastructure/persistence/drizzle/repositories/judging.repository';
import { DrizzlePullRequestRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleScoreRepository } from '@insights/infrastructure/persistence/drizzle/repositories/score.repository';
import { DrizzleSideBySideJudgingRepository } from '@insights/infrastructure/persistence/drizzle/repositories/side-by-side-judging.repository';
import { DrizzleStationAlertStateRepository } from '@insights/infrastructure/persistence/drizzle/repositories/station-alert-state.repository';
import { DrizzleTaskChangeShapeRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-change-shape.repository';
import { DrizzleTaskFailuresRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import { DrizzleTaskHumanActionsRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-human-actions.repository';
import { DrizzleTaskPullRequestRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-pull-request.repository';
import { stationConfigPullRequest } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { insightsSubscribers } from '@insights/presentation/events/insights.subscribers';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { CHANGE_CHECKED } from '@shared-kernel/application/integration-events/change-checked.integration-event';
import { CHAT_STARTED } from '@shared-kernel/application/integration-events/chat-started.integration-event';
import { CONFIG_PULL_REQUEST_OPENED } from '@shared-kernel/application/integration-events/config-pull-request-opened.integration-event';
import { PULL_REQUEST_CLOSED } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import { PULL_REQUEST_OPENED } from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import { RUN_ENDED } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { RUN_USAGE_RECORDED } from '@shared-kernel/application/integration-events/run-usage-recorded.integration-event';
import { TASK_ACTED_ON } from '@shared-kernel/application/integration-events/task-acted-on.integration-event';
import { TASK_DELETED } from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import { TEAM_DELETED } from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import { WORKSPACE_DELETED } from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { DomainEventSubscriber } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const WORKSPACE = 'ws_1';
const SONNET = 'a'.repeat(64);
const OPUS = 'b'.repeat(64);
const PULL = 'https://github.com/acme/api/pull/12';

const at = (hour: number) =>
  new Date(`2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

const configOf = (fingerprint: string, model: string): ConfigInOrder => ({
  fingerprint,
  config: {
    prompt: 'Implement the task.',
    harness: 'claude-code',
    model,
    effort: null,
    profile: null,
    image: null,
    repositories: [{ name: 'acme/api', setup: null }],
    skills: [],
    tools: [],
    decisions: false,
    memories: false,
  },
  changes: [],
});

const ended = new Map<string, EndedRun>();

const QUIET: LoggerPort = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const endedRun = (
  runId: string,
  change: Partial<EndedRun> & { endedAt: Date },
): EndedRun => {
  const run: EndedRun = {
    runId,
    workspaceId: WORKSPACE,
    teamId: 'team_1',
    lineId: 'line_1',
    stationId: 'station_1',
    taskId: 'task_1',
    fingerprint: SONNET,
    visit: 1,
    harness: 'claude-code',
    model: 'sonnet',
    effort: null,
    profileKey: null,
    repositories: ['acme/api'],
    skills: [],
    queuedAt: new Date('2026-09-30T00:00:00.000Z'),
    startedAt: null,
    ...change,
  };
  ended.set(runId, run);
  return run;
};

const work: WorkPort = {
  endedRun: async (runId) => ended.get(runId) ?? null,
  unfinishedRuns: async () => [],
  traced: async () => ({ tasks: [], stations: [], outputs: new Map() }),
  teamRepositories: async () => [],
  teamSkillKeys: async () => [],
  alertsAt: async () => null,
  configsInOrder: async (fingerprints) =>
    fingerprints.map((fingerprint, index) => ({
      ...configOf(fingerprint, fingerprint === SONNET ? 'sonnet' : 'opus'),
      changes:
        index > 0 && fingerprints[index - 1] !== fingerprint
          ? [
              {
                part: 'model',
                name: null,
                kind: 'changed' as const,
                was: fingerprints[index - 1] === SONNET ? 'sonnet' : 'opus',
                now: fingerprint === SONNET ? 'sonnet' : 'opus',
              },
            ]
          : [],
    })),
};

let database: TestDatabase;
let records: DrizzleRunRecordRepository;
let taskPullRequests: DrizzleTaskPullRequestRepository;
let subscribers: readonly DomainEventSubscriber[];
let listing: ReadStationInsightsHandler;
let context: DrizzleContext;
let deletions: DrizzleDeletions;
let chats: DrizzleChatRecordRepository;
let configPullRequests: DrizzleStationConfigPullRequests;

const deliver = async (name: string, event: Record<string, unknown>) => {
  const subscriber = subscribers.find((each) => each.name === name);

  if (!subscriber) {
    throw new Error(`no subscriber ${name}`);
  }

  await subscriber.handle(event as never);
};

const runEnded = async (
  runId: string,
  change: Record<string, unknown> = {},
) => {
  const taskId = ended.get(runId)?.taskId ?? 'task_1';

  await deliver('insights.record-ended-run', {
    kind: RUN_ENDED,
    runId,
    workspaceId: WORKSPACE,
    taskId,
    stationId: 'station_1',
    outcome: 'completed',
    failure: null,
    stopped: false,
    ...change,
  });
  await deliver('insights.record-run-usage', {
    kind: RUN_USAGE_RECORDED,
    runId,
    workspaceId: WORKSPACE,
    taskId,
    ms: 60_000,
    steps: 20,
    errors: 1,
    changedLines: 0,
    contextTokens: 8_000,
    contextWindow: null,
    cost: 0.4,
    currency: 'USD',
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    servers: [],
    skillsRead: [],
  });
};

const list = (viewer = 'user_ada') =>
  listing.execute(
    new ReadStationInsightsQuery('team_1', 'line_1', 'station_1', viewer, null),
  );

const listAt = (workspaceId: string, teamId: string) =>
  new ReadStationInsightsHandler(
    new InsightsAccess({
      namesOf: async () => new Map(),
      membershipOnTeam: async (_teamId, principal) => ({
        workspaceId: WorkspaceId.of(workspaceId),
        by: principal.userId,
      }),
    }),
    records,
    taskPullRequests,
    configPullRequests,
    work,
  ).execute(
    new ReadStationInsightsQuery(
      teamId,
      'line_1',
      'station_1',
      'user_ada',
      null,
    ),
  );

const configPullRequestOpened = (
  workspaceId: string,
  teamId: string,
  id: string,
) =>
  deliver('insights.record-opened-config-pull-request', {
    kind: CONFIG_PULL_REQUEST_OPENED,
    configPullRequestId: id,
    workspaceId,
    teamId,
    stationId: 'station_1',
    fingerprint: OPUS,
    url: `https://github.com/acme/platform/pull/${id}`,
    at: at(17).toISOString(),
  });

beforeAll(async () => {
  database = await openDatabase('station_insights');
  context = new DrizzleContext(database.db);
  const quiet = {
    dispatch: async () => {},
  } as unknown as DomainEventDispatcher;
  records = new DrizzleRunRecordRepository(
    context,
    new DrizzleRunFactProjection(context),
    quiet,
  );
  taskPullRequests = new DrizzleTaskPullRequestRepository(
    context,
    new DrizzleRunFactProjection(context),
    quiet,
  );
  const judgings = new DrizzleJudgingRepository(context, quiet);
  const scores = new DrizzleScoreRepository(context, quiet);
  const humanActions = new DrizzleTaskHumanActionsRepository(
    context,
    new DrizzleRunFactProjection(context),
  );
  const failures = new DrizzleTaskFailuresRepository(context);
  chats = new DrizzleChatRecordRepository(context);
  const pullRequests = new DrizzlePullRequestRecordRepository(context);
  const shapes = new DrizzleTaskChangeShapeRepository(context);
  const alertStates = new DrizzleStationAlertStateRepository(context, quiet);
  const reviews = new DrizzlePendingReviews(context);
  configPullRequests = new DrizzleStationConfigPullRequests(context);
  deletions = new DrizzleDeletions(context);
  subscribers = insightsSubscribers({
    ending: new RecordRunEnding(work, records, deletions, context, QUIET),
    superseding: new RecordSupersededRun(records, deletions, context, {
      now: () => RECEIVED_AT,
      sleep: async () => {},
    }),
    checking: new RecordChangeChecks(records, deletions, context, {
      now: () => RECEIVED_AT,
      sleep: async () => {},
    }),
    acting: new RecordHumanAction(work, records, deletions, context),
    opening: new RecordPullRequestOpening(
      taskPullRequests,
      reviews,
      deletions,
      context,
      { now: () => new Date(), sleep: async () => {} },
    ),
    closing: new RecordPullRequestClosing(taskPullRequests, context),
    deleting: new DeleteInsights(
      {
        records,
        taskPullRequests,
        judgings,
        changeJudgings: new DrizzleChangeJudgingRepository(context, quiet),
        sideBySideJudgings: new DrizzleSideBySideJudgingRepository(
          context,
          quiet,
        ),
        scores,
        taskHumanActions: humanActions,
        failures,
        chats,
        pullRequests,
        shapes,
        alertStates,
        reviews,
        configPullRequests,
        deletions,
      },
      context,
    ),
    judging: new RequestJudging(
      work,
      {
        hasTask: async () => true,
        of: async () => null,
        judgesOnTeam: async () => new Map(),
        judgeAt: async () => null,
      },
      {
        available: false,
        model: 'some/model',
        judge: async () => ({
          verdict: { value: true, reasons: [] },
          guidance: null,
          usage: null,
        }),
      },
      judgings,
      deletions,
      context,
      { now: () => new Date(), sleep: async () => {} },
    ),
    scoring: new RecordJudgeScore(judgings, scores, context, {
      generate: () => 'id',
    }),
    grading: new GradeInboxRequests({
      ask: async () => {},
      resolve: async () => {},
    }),
    recordingUsage: new RecordRunUsageSummary(
      work,
      records,
      deletions,
      context,
    ),
    remembering: new RecordRunMemories(work, records, deletions, context),
    passing: new RecordStationPass(records, deletions, context),
    reviewing: new RecordPullRequestReview(
      taskPullRequests,
      reviews,
      deletions,
      context,
      { now: () => new Date(), sleep: async () => {} },
    ),
    failing: new RecordTaskFailure(failures, deletions, context),
    recordingHumanActions: new RecordTaskHumanAction(
      humanActions,
      deletions,
      context,
    ),
    chatting: new RecordChat(chats, deletions, context),
    recording: new RecordPullRequests(pullRequests, deletions, context),
    shaping: new RecordChangeShape(work, shapes, deletions, context),
    watching: new WatchStations(
      work,
      {
        records,
        taskPullRequests,
        alertStates,
        deletions,
      },
      context,
      { generate: () => 'alert_1' },
      { now: () => new Date(), sleep: async () => {} },
    ),
    alerting: new AlertInbox(
      {
        open: async () => {},
        resolve: async () => {},
      },
      alertStates,
    ),
    openingConfigPullRequests: new RecordConfigPullRequest(
      configPullRequests,
      deletions,
      context,
    ),
  });
  listing = new ReadStationInsightsHandler(
    new InsightsAccess({
      namesOf: async () => new Map(),
      membershipOnTeam: async (_teamId, principal) =>
        principal.userId.equals(UserId.of('user_ada'))
          ? { workspaceId: WorkspaceId.of(WORKSPACE), by: principal.userId }
          : null,
    }),
    records,
    taskPullRequests,
    configPullRequests,
    work,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('how a station’s runs turned out', () => {
  it('records an ended run with its config and visit', async () => {
    endedRun('run_1', {
      startedAt: at(8),
      endedAt: at(9),
      fingerprint: SONNET,
    });

    await runEnded('run_1', { outcome: 'failed', failure: 'exited' });

    const record = await records.of(RunId.of('run_1'));
    expect(record?.ending).toBe('failed');
    expect(record?.end?.failure).toBe('exited');
    expect(record?.end?.fingerprint).toBe(SONNET);
    expect(record?.end?.visit).toBe(1);
    expect(record?.end?.endedAt).toEqual(at(9));
  });

  it('attaches the first thing a person did after the run', async () => {
    await deliver('insights.record-first-human-action', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      stationId: 'station_1',
      action: 'sent-back',
      by: 'user_ada',
      afterRunId: null,
      at: at(10).toISOString(),
    });
    await deliver('insights.record-first-human-action', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      stationId: 'station_1',
      action: 'accepted',
      by: 'user_ada',
      afterRunId: 'run_1',
      at: at(10).toISOString(),
    });

    const record = await records.of(RunId.of('run_1'));
    expect(record?.firstHumanAction?.kind).toBe('sent-back');
    expect(record?.firstHumanAction?.at).toEqual(at(10));
  });

  it('attaches checks received before and after the run ended', async () => {
    await deliver('insights.record-checked-change', {
      kind: CHANGE_CHECKED,
      runId: 'run_2',
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      passed: true,
    });
    endedRun('run_2', {
      startedAt: at(10),
      endedAt: at(11),
      fingerprint: OPUS,
      visit: 2,
    });
    await runEnded('run_2');
    await deliver('insights.record-checked-change', {
      kind: CHANGE_CHECKED,
      runId: 'run_1',
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      passed: false,
    });

    expect((await records.of(RunId.of('run_2')))?.checks).toBe('passed');
    expect((await records.of(RunId.of('run_2')))?.end?.visit).toBe(2);
    expect((await records.of(RunId.of('run_1')))?.checks).toBe('failed');
  });

  it('follows the task’s pull request from opened to merged', async () => {
    await deliver('insights.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      teamId: 'team_1',
      url: PULL,
      at: at(12).toISOString(),
    });
    await deliver('insights.record-closed-pull-request', {
      kind: PULL_REQUEST_CLOSED,
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      repository: 'acme/api',
      closedAt: at(13).toISOString(),
      merged: true,
      mergeCommit: 'c0ffee',
    });

    const outcomes = await new RunOutcomes(records, taskPullRequests).of(
      ['run_1', 'run_2'],
      null,
    );

    expect(outcomes.get('run_1')?.pullRequestState).toBe('merged');
    expect(outcomes.get('run_2')).toMatchObject({
      fingerprint: OPUS,
      ending: 'completed',
      visit: 2,
      checks: 'passed',
      pullRequestState: 'merged',
    });
  });

  it('groups the station’s runs at each config change in start order, the newest first, keeping a run cancelled before it ran another config apart from the group in force', async () => {
    endedRun('run_3', {
      startedAt: at(11),
      endedAt: at(12),
      fingerprint: OPUS,
      taskId: 'task_2',
    });
    await runEnded('run_3', { stopped: true });
    endedRun('run_cancelled', {
      endedAt: new Date('2026-09-30T10:30:00.000Z'),
      fingerprint: SONNET,
    });
    await runEnded('run_cancelled', { outcome: 'cancelled' });
    endedRun('run_4', {
      startedAt: at(13),
      endedAt: at(14),
      fingerprint: SONNET,
    });
    await runEnded('run_4');

    const outcomes = await list();

    expect(
      outcomes.groups.map((group) => ({
        firstRunId: group.firstRunId,
        fingerprint: group.fingerprint,
        ran: group.ran,
        model: group.config?.model,
        changes: group.changes.map((each) => [each.was, each.now]),
        runs: group.runs.map((each) => [each.runId, each.ending]),
      })),
    ).toEqual([
      {
        firstRunId: 'run_4',
        fingerprint: SONNET,
        ran: true,
        model: 'sonnet',
        changes: [['opus', 'sonnet']],
        runs: [['run_4', 'completed']],
      },
      {
        firstRunId: 'run_3',
        fingerprint: OPUS,
        ran: true,
        model: 'opus',
        changes: [],
        runs: [['run_3', 'stopped']],
      },
      {
        firstRunId: 'run_cancelled',
        fingerprint: SONNET,
        ran: false,
        model: 'sonnet',
        changes: [['opus', 'sonnet']],
        runs: [['run_cancelled', 'cancelled']],
      },
      {
        firstRunId: 'run_2',
        fingerprint: OPUS,
        ran: true,
        model: 'opus',
        changes: [['sonnet', 'opus']],
        runs: [['run_2', 'completed']],
      },
      {
        firstRunId: 'run_1',
        fingerprint: SONNET,
        ran: true,
        model: 'sonnet',
        changes: [],
        runs: [['run_1', 'failed']],
      },
    ]);
    expect(outcomes.groups[2]?.tally).toMatchObject({
      runs: 0,
      cancelled: 1,
    });
    expect(outcomes.groups[1]?.tally).toMatchObject({
      runs: 1,
      cancelled: 0,
      stopped: 1,
      cost: { amount: 0.4, currency: 'USD' },
    });
    expect(outcomes.groups[3]?.tally).toMatchObject({
      runs: 1,
      cancelled: 0,
      stopped: 0,
      checksPassed: 1,
      merged: 1,
      cost: { amount: 0.4, currency: 'USD' },
    });
    expect(outcomes.groups[4]?.tally).toMatchObject({
      runs: 1,
      failed: 1,
      checksFailed: 1,
      sentBack: 1,
      merged: 1,
    });
    expect(outcomes.inForce).toEqual({
      tally: expect.objectContaining({ runs: 1, cancelled: 0 }),
    });
  });

  it('shows on each group the latest pull request Spotlight opened proposing its config at the station, and none on a config it proposed nowhere', async () => {
    const opened = (
      id: string,
      fingerprint: string,
      hour: number,
      stationId = 'station_1',
    ) =>
      deliver('insights.record-opened-config-pull-request', {
        kind: CONFIG_PULL_REQUEST_OPENED,
        configPullRequestId: id,
        workspaceId: WORKSPACE,
        teamId: 'team_1',
        stationId,
        fingerprint,
        url: `https://github.com/acme/platform/pull/${id}`,
        at: at(hour).toISOString(),
      });

    await opened('41', OPUS, 7);
    await opened('42', OPUS, 9);
    await opened('43', SONNET, 9, 'station_2');
    await opened('41', OPUS, 7);

    const outcomes = await list();

    expect(
      await database.db
        .select({ openedAt: stationConfigPullRequest.openedAt })
        .from(stationConfigPullRequest)
        .where(eq(stationConfigPullRequest.configPullRequestId, '41')),
    ).toEqual([{ openedAt: at(7) }]);

    expect(
      outcomes.groups.map((group) => [group.firstRunId, group.pullRequest]),
    ).toEqual([
      ['run_4', null],
      ['run_3', { url: 'https://github.com/acme/platform/pull/42' }],
      ['run_cancelled', null],
      ['run_2', { url: 'https://github.com/acme/platform/pull/42' }],
      ['run_1', null],
    ]);
  });

  it('carries on the config of the station’s last config run before the oldest listed run, setting the oldest group against it', async () => {
    const lastOf = async (last: number) =>
      (
        await listing.execute(
          new ReadStationInsightsQuery(
            'team_1',
            'line_1',
            'station_1',
            'user_ada',
            last,
          ),
        )
      ).groups.map((group) => ({
        firstRunId: group.firstRunId,
        fingerprint: group.fingerprint,
        changes: group.changes.map((each) => [each.was, each.now]),
        runs: group.runs.map((each) => each.runId),
      }));

    expect(await lastOf(2)).toEqual([
      {
        firstRunId: 'run_4',
        fingerprint: SONNET,
        changes: [['opus', 'sonnet']],
        runs: ['run_4'],
      },
      {
        firstRunId: 'run_3',
        fingerprint: OPUS,
        changes: [],
        runs: ['run_3'],
      },
    ]);
    expect(await lastOf(1)).toEqual([
      {
        firstRunId: 'run_4',
        fingerprint: SONNET,
        changes: [['opus', 'sonnet']],
        runs: ['run_4'],
      },
    ]);
  });

  it('finds no team for someone not on it', async () => {
    await expect(list('user_eve')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('does not write over a record that changed since it was read', async () => {
    const read = await records.of(RunId.of('run_3'));

    if (!read) {
      throw new Error('not stored');
    }

    await records.save(read.recordCheck('passed', RECEIVED_AT));

    await expect(
      records.save(read.recordCheck('failed', RECEIVED_AT)),
    ).rejects.toBeInstanceOf(RunRecordVersionConflictError);
  });

  it('deletes the runs and pull request of a deleted task', async () => {
    const deleted = {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
    };

    await deliver('insights.record-first-human-action', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      stationId: 'station_1',
      action: 'answered',
      by: 'user_ada',
      afterRunId: 'run_9',
      at: at(14).toISOString(),
    });
    expect(await records.of(RunId.of('run_9'))).not.toBeNull();

    await deliver('insights.delete-runs-of-deleted-task', deleted);
    await deliver('insights.delete-task-pull-request-of-deleted-task', deleted);

    expect(await records.of(RunId.of('run_1'))).toBeNull();
    expect(await records.of(RunId.of('run_9'))).toBeNull();
    expect(await records.of(RunId.of('run_3'))).not.toBeNull();
    expect((await list()).groups.flatMap((each) => each.runs)).toHaveLength(1);
  });

  it('records nothing more of a deleted task, however late its events arrive', async () => {
    await deliver('insights.record-first-human-action', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      stationId: 'station_1',
      action: 'answered',
      by: 'user_ada',
      afterRunId: 'run_10',
      at: at(15).toISOString(),
    });
    await deliver('insights.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      teamId: 'team_1',
      url: 'https://github.com/acme/api/pull/99',
      at: at(15).toISOString(),
    });

    expect(await records.of(RunId.of('run_10'))).toBeNull();
    expect(await taskPullRequests.forTask(TaskId.of('task_1'))).toBeNull();
  });

  it('records nothing of a task whose events arrive while its deletion is under way, once the deletion commits', async () => {
    let locked: () => void = () => {};
    let release: () => void = () => {};
    const deletionLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deletion = context.inTransaction(async () => {
      await deletions.deleteTask(
        WorkspaceId.of(WORKSPACE),
        TaskId.of('task_9'),
      );
      locked();
      await released;
    });
    await deletionLocked;

    const noting = deliver('insights.record-first-human-action', {
      kind: TASK_ACTED_ON,
      taskId: 'task_9',
      workspaceId: WORKSPACE,
      stationId: 'station_1',
      action: 'answered',
      by: 'user_ada',
      afterRunId: 'run_90',
      at: at(16).toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    release();
    await deletion;
    await noting;

    expect(await records.of(RunId.of('run_90'))).toBeNull();
  });

  it('records nothing more of a deleted team, however late its events arrive', async () => {
    await deliver('insights.delete-chats-of-deleted-team', {
      kind: TEAM_DELETED,
      workspaceId: WORKSPACE,
      teamId: 'team_gone',
      key: 'gone',
    });

    await deliver('insights.record-started-chat', {
      kind: CHAT_STARTED,
      chatId: 'chat_gone',
      workspaceId: WORKSPACE,
      teamId: 'team_gone',
      by: 'user_ada',
      at: at(16).toISOString(),
    });

    expect(await chats.of('chat_gone')).toBeNull();
  });

  it('stores no config pull request of a deleted team that arrives late', async () => {
    endedRun('run_deleted', {
      teamId: 'team_deleted',
      taskId: 'task_deleted',
      fingerprint: OPUS,
      startedAt: at(16),
      endedAt: at(17),
    });
    await runEnded('run_deleted');

    await deliver('insights.delete-config-pull-requests-of-deleted-team', {
      kind: TEAM_DELETED,
      workspaceId: WORKSPACE,
      teamId: 'team_deleted',
      key: 'deleted',
    });
    await configPullRequestOpened(WORKSPACE, 'team_deleted', '51');

    const outcomes = await listAt(WORKSPACE, 'team_deleted');

    expect(outcomes.groups.map((group) => group.pullRequest)).toEqual([null]);
  });

  it('stores no config pull request of a deleted workspace that arrives late', async () => {
    endedRun('run_deleted_ws', {
      workspaceId: 'ws_deleted',
      teamId: 'team_deleted_ws',
      taskId: 'task_deleted_ws',
      fingerprint: OPUS,
      startedAt: at(16),
      endedAt: at(17),
    });
    await runEnded('run_deleted_ws', { workspaceId: 'ws_deleted' });

    await deliver('insights.delete-config-pull-requests-of-deleted-workspace', {
      kind: WORKSPACE_DELETED,
      workspaceId: 'ws_deleted',
      slug: 'deleted',
    });
    await configPullRequestOpened('ws_deleted', 'team_deleted_ws', '52');

    const outcomes = await listAt('ws_deleted', 'team_deleted_ws');

    expect(outcomes.groups.map((group) => group.pullRequest)).toEqual([null]);
  });
});

describe('the config runs a station’s runs make', () => {
  let configIntervals: DrizzleRunRecordRepository;
  const plannedRuns: string[] = [];

  interface Planned {
    readonly runId: string;
    readonly fingerprint: string | null;
    readonly startedAt: Date | null;
    readonly endedAt: Date;
    readonly outcome?: 'cancelled' | 'failed';
  }

  const minute = (minutes: number) =>
    new Date(Date.UTC(2026, 9, 1, 9, minutes));

  const planned = (
    runId: string,
    fingerprint: string | null,
    startedAt: number | null,
    change: { endedAt?: number; outcome?: 'cancelled' | 'failed' } = {},
  ): Planned => ({
    runId,
    fingerprint,
    startedAt: startedAt === null ? null : minute(startedAt),
    endedAt: minute(change.endedAt ?? (startedAt ?? 0) + 30),
    outcome: change.outcome,
  });

  const ranAt = async (
    stationId: string,
    runs: readonly Planned[],
    teamId = 'team_1',
  ) => {
    const noting = new RecordRunEnding(
      work,
      configIntervals,
      deletions,
      context,
      QUIET,
    );

    for (const run of runs) {
      endedRun(run.runId, {
        stationId,
        teamId,
        taskId: `task_${teamId}_${stationId}`,
        fingerprint: run.fingerprint,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
      });
      plannedRuns.push(run.runId);
    }
    for (const run of [...runs].reverse()) {
      const outcome = run.outcome ?? 'completed';

      await noting.ended({
        runId: run.runId,
        outcome,
        stopped: false,
        failure: outcome === 'failed' ? 'exited' : null,
        asked: false,
      });
    }
  };

  beforeAll(async () => {
    configIntervals = new DrizzleRunRecordRepository(
      context,
      new DrizzleRunFactProjection(context),
      {
        dispatch: async () => {},
      } as unknown as DomainEventDispatcher,
    );

    await ranAt('station_aba', [
      planned('aba_1', SONNET, 1),
      planned('aba_2', OPUS, 2),
      planned('aba_3', SONNET, 3),
      planned('aba_4', SONNET, 4),
    ]);
    await ranAt('station_aba', [planned('aba_elsewhere', OPUS, 3)], 'team_2');
    await ranAt('station_tie', [
      planned('tie_b', OPUS, 5),
      planned('tie_a', SONNET, 5),
      planned('tie_c', SONNET, 6),
    ]);
    await ranAt('station_unstarted', [
      planned('unstarted_1', SONNET, 1),
      planned('unstarted_cancelled', OPUS, null, {
        endedAt: 2,
        outcome: 'cancelled',
      }),
      planned('unstarted_2', SONNET, 3),
      planned('unstarted_failed', OPUS, null, {
        endedAt: 4,
        outcome: 'failed',
      }),
      planned('unstarted_3', SONNET, 5),
    ]);
    await ranAt('station_unconfigured', [
      planned('unconfigured_1', SONNET, 1),
      planned('unconfigured_none', null, 2),
      planned('unconfigured_not_sha', 'not-a-sha-256', 3),
      planned('unconfigured_2', SONNET, 4),
      planned('unconfigured_late', OPUS, 0, { endedAt: 50 }),
    ]);
  });

  it('reads the last run that ran a config before each station’s time, passing over runs that never started and other teams’ runs', async () => {
    const lastFrom = async (
      bounds: readonly ConfigIntervalBound[],
      teamId = 'team_1',
    ) => {
      const fromSql = (
        await context.inTransaction(() =>
          configIntervals.lastConfigRunsBefore(TeamId.of(teamId), bounds),
        )
      )
        .map((each) => each.runId.value)
        .sort();
      const records = await configIntervals.ofRuns(
        plannedRuns.map((each) => RunId.of(each)),
      );
      const fromDomain = lastConfigRunsFrom(
        records.filter((each) => each.end?.location.teamId.value === teamId),
        bounds,
      )
        .map((each) => each.runId.value)
        .sort();

      expect(fromSql).toEqual(fromDomain);

      return fromSql;
    };

    expect(
      await lastFrom([
        { stationId: 'station_aba', from: minute(3) },
        { stationId: 'station_unstarted', from: minute(5) },
        { stationId: 'station_tie', from: minute(5) },
        { stationId: 'station_unconfigured', from: minute(4) },
      ]),
    ).toEqual(['aba_2', 'unconfigured_1', 'unstarted_2']);
    expect(
      await lastFrom([{ stationId: 'station_aba', from: minute(4) }], 'team_2'),
    ).toEqual(['aba_elsewhere']);
    expect(
      await lastFrom([
        { stationId: 'station_aba', from: minute(9) },
        { stationId: 'station_aba', from: minute(2) },
      ]),
    ).toEqual(['aba_1']);
    expect(
      await lastFrom([
        {
          stationId: 'station_tie',
          from: minute(5),
          fromRun: RunId.of('tie_b'),
        },
      ]),
    ).toEqual(['tie_a']);
    expect(
      await lastFrom([
        {
          stationId: 'station_tie',
          from: minute(5),
          fromRun: RunId.of('tie_a'),
        },
      ]),
    ).toEqual([]);
    expect(await lastFrom([])).toEqual([]);
  });
  const listedAt = async (stationId: string, last: number | null = null) =>
    (
      await listing.execute(
        new ReadStationInsightsQuery(
          'team_1',
          'line_1',
          stationId,
          'user_ada',
          last,
        ),
      )
    ).groups.map((group) => ({
      firstRunId: group.firstRunId,
      fingerprint: group.fingerprint,
      ran: group.ran,
      changes: group.changes.map((each) => [each.was, each.now]),
      runs: group.runs.map((each) => each.runId),
      failed: group.tally.failed,
    }));

  it('lists runs meant for a config that failed to provision apart from the group in force, A, B never ran, A again', async () => {
    await ranAt('station_never', [
      planned('never_a1', SONNET, 1),
      planned('never_b1', OPUS, null, { endedAt: 2, outcome: 'failed' }),
      planned('never_b2', OPUS, null, { endedAt: 3, outcome: 'failed' }),
      planned('never_a2', SONNET, 4),
    ]);

    expect(await listedAt('station_never')).toEqual([
      {
        firstRunId: 'never_a2',
        fingerprint: SONNET,
        ran: true,
        changes: [],
        runs: ['never_a2'],
        failed: 0,
      },
      {
        firstRunId: 'never_b1',
        fingerprint: OPUS,
        ran: false,
        changes: [['sonnet', 'opus']],
        runs: ['never_b2', 'never_b1'],
        failed: 2,
      },
      {
        firstRunId: 'never_a1',
        fingerprint: SONNET,
        ran: true,
        changes: [],
        runs: ['never_a1'],
        failed: 0,
      },
    ]);
  });

  it('lists the latest-started runs, not the latest-ended, carrying on from the run before the oldest, though it began at the same instant', async () => {
    await ranAt('station_order', [
      planned('order_long', OPUS, 1, { endedAt: 59 }),
      planned('order_x', SONNET, 5),
      planned('order_y', OPUS, 5),
    ]);

    expect(await listedAt('station_order', 1)).toEqual([
      {
        firstRunId: 'order_y',
        fingerprint: OPUS,
        ran: true,
        changes: [['sonnet', 'opus']],
        runs: ['order_y'],
        failed: 0,
      },
    ]);
    expect(
      (await listedAt('station_order', 2)).map((each) => each.runs),
    ).toEqual([['order_y'], ['order_x']]);
  });
});
