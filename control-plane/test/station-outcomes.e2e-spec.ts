import type {
  ConfigInOrder,
  EndedRun,
  WorkPort,
} from '@outcomes/application/ports/work.port';
import { ListStationOutcomesHandler } from '@outcomes/application/queries/handlers/list-station-outcomes.handler';
import { ListStationOutcomesQuery } from '@outcomes/application/queries/list-station-outcomes.query';
import { AlertInbox } from '@outcomes/application/services/alert-inbox.service';
import { AskForJudging } from '@outcomes/application/services/ask-for-judging.service';
import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
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
import { NoteRunHandedOn } from '@outcomes/application/services/note-run-handed-on.service';
import { NoteRunMemories } from '@outcomes/application/services/note-run-memories.service';
import { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import { NoteTaskFailed } from '@outcomes/application/services/note-task-failed.service';
import { NoteTaskTouch } from '@outcomes/application/services/note-task-touch.service';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import { RunOutcomes } from '@outcomes/application/services/run-outcomes.service';
import { WatchStations } from '@outcomes/application/services/watch-stations.service';
import { RunRecordVersionConflictError } from '@outcomes/domain/exceptions/run-record-version-conflict.error';
import { lastConfigRunsFrom } from '@outcomes/domain/outcomes.fake-spec';
import type { StretchBound } from '@outcomes/domain/services/config-stretches';
import { DrizzleForgotten } from '@outcomes/infrastructure/persistence/drizzle/ledgers/forgotten.ledger';
import { DrizzlePendingReviews } from '@outcomes/infrastructure/persistence/drizzle/ledgers/pending-reviews.ledger';
import { DrizzleStationConfigPullRequests } from '@outcomes/infrastructure/persistence/drizzle/ledgers/station-config-pull-requests.ledger';
import { DrizzleRunFactProjection } from '@outcomes/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { DrizzleChangeJudgingRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/change-judging.repository';
import { DrizzleChatRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/chat-record.repository';
import { DrizzleJudgingRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/judging.repository';
import { DrizzlePairJudgingRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/pair-judging.repository';
import { DrizzlePullRequestRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import { DrizzleRunRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleScoreRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/score.repository';
import { DrizzleStationWatchRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/station-watch.repository';
import { DrizzleTaskChangeShapeRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-change-shape.repository';
import { DrizzleTaskDeliveryRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-delivery.repository';
import { DrizzleTaskFailuresRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import { DrizzleTaskTouchesRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-touches.repository';
import { stationConfigPullRequest } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { outcomesSubscribers } from '@outcomes/presentation/events/outcomes.subscribers';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { CHANGE_CHECKED } from '@shared-kernel/application/integration-events/change-checked.integration-event';
import { CHAT_STARTED } from '@shared-kernel/application/integration-events/chat-started.integration-event';
import { CONFIG_PULL_REQUEST_OPENED } from '@shared-kernel/application/integration-events/config-pull-request-opened.integration-event';
import { PULL_REQUEST_CLOSED } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import { PULL_REQUEST_OPENED } from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import { RUN_DIGESTED } from '@shared-kernel/application/integration-events/run-digested.integration-event';
import { RUN_ENDED } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { TASK_ACTED_ON } from '@shared-kernel/application/integration-events/task-acted-on.integration-event';
import { TASK_DELETED } from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import { TEAM_DISBANDED } from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import { WORKSPACE_CLOSED } from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
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

const HEARD_AT = new Date('2026-09-30T12:00:00.000Z');

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
    round: 1,
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
let deliveries: DrizzleTaskDeliveryRepository;
let subscribers: readonly DomainEventSubscriber[];
let listing: ListStationOutcomesHandler;
let context: DrizzleContext;
let forgotten: DrizzleForgotten;
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

  await deliver('outcomes.record-ended-run', {
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
  await deliver('outcomes.record-run-cost', {
    kind: RUN_DIGESTED,
    runId,
    workspaceId: WORKSPACE,
    taskId,
    ms: 60_000,
    steps: 20,
    faults: 1,
    changedLines: 0,
    used: 8_000,
    size: null,
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
    new ListStationOutcomesQuery('team_1', 'line_1', 'station_1', viewer, null),
  );

const listAt = (workspaceId: string, teamId: string) =>
  new ListStationOutcomesHandler(
    new OutcomesAccess({
      namesOf: async () => new Map(),
      membershipOnTeam: async (_teamId, principal) => ({
        workspaceId: WorkspaceId.of(workspaceId),
        by: principal.userId,
      }),
    }),
    records,
    deliveries,
    configPullRequests,
    work,
  ).execute(
    new ListStationOutcomesQuery(
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
  deliver('outcomes.record-opened-config-pull-request', {
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
  database = await openDatabase('station_outcomes');
  context = new DrizzleContext(database.db);
  const quiet = {
    dispatch: async () => {},
  } as unknown as DomainEventDispatcher;
  records = new DrizzleRunRecordRepository(
    context,
    new DrizzleRunFactProjection(context),
    quiet,
  );
  deliveries = new DrizzleTaskDeliveryRepository(
    context,
    new DrizzleRunFactProjection(context),
    quiet,
  );
  const judgings = new DrizzleJudgingRepository(context, quiet);
  const scores = new DrizzleScoreRepository(context, quiet);
  const touches = new DrizzleTaskTouchesRepository(
    context,
    new DrizzleRunFactProjection(context),
  );
  const failures = new DrizzleTaskFailuresRepository(context);
  chats = new DrizzleChatRecordRepository(context);
  const pullRequests = new DrizzlePullRequestRecordRepository(context);
  const shapes = new DrizzleTaskChangeShapeRepository(context);
  const watches = new DrizzleStationWatchRepository(context, quiet);
  const reviews = new DrizzlePendingReviews(context);
  configPullRequests = new DrizzleStationConfigPullRequests(context);
  forgotten = new DrizzleForgotten(context);
  subscribers = outcomesSubscribers({
    ending: new NoteRunEnded(work, records, forgotten, context, QUIET),
    superseding: new NoteRunSuperseded(records, forgotten, context, {
      now: () => HEARD_AT,
      sleep: async () => {},
    }),
    checking: new NoteChangeChecked(records, forgotten, context, {
      now: () => HEARD_AT,
      sleep: async () => {},
    }),
    acting: new NotePersonAct(work, records, forgotten, context),
    opening: new NotePullRequestOpened(
      deliveries,
      reviews,
      forgotten,
      context,
      { now: () => new Date(), sleep: async () => {} },
    ),
    closing: new NotePullRequestClosed(deliveries, context),
    forgetting: new ForgetOutcomes(
      {
        records,
        deliveries,
        judgings,
        changeJudgings: new DrizzleChangeJudgingRepository(context, quiet),
        pairJudgings: new DrizzlePairJudgingRepository(context, quiet),
        scores,
        touches,
        failures,
        chats,
        pullRequests,
        shapes,
        watches,
        reviews,
        configPullRequests,
        forgotten,
      },
      context,
    ),
    judging: new AskForJudging(
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
          usage: null,
        }),
      },
      judgings,
      forgotten,
      context,
      { now: () => new Date(), sleep: async () => {} },
    ),
    scoring: new RecordJudgeScore(judgings, scores, context, {
      generate: () => 'id',
    }),
    grading: new GradeAsides({
      ask: async () => {},
      settle: async () => {},
    }),
    digesting: new NoteRunDigested(work, records, forgotten, context),
    remembering: new NoteRunMemories(work, records, forgotten, context),
    handingOn: new NoteRunHandedOn(records, forgotten, context),
    reviewing: new NotePullRequestReviewed(
      deliveries,
      reviews,
      forgotten,
      context,
      { now: () => new Date(), sleep: async () => {} },
    ),
    failing: new NoteTaskFailed(failures, forgotten, context),
    touching: new NoteTaskTouch(touches, forgotten, context),
    chatting: new NoteChatStarted(chats, forgotten, context),
    recording: new NotePullRequestRecords(pullRequests, forgotten, context),
    shaping: new NoteChangeShaped(work, shapes, forgotten, context),
    watching: new WatchStations(
      work,
      { records, deliveries, watches, forgotten },
      context,
      { generate: () => 'alert_1' },
      { now: () => new Date(), sleep: async () => {} },
    ),
    alerting: new AlertInbox(
      {
        open: async () => {},
        settle: async () => {},
      },
      watches,
    ),
    openingConfigPullRequests: new NoteConfigPullRequestOpened(
      configPullRequests,
      forgotten,
      context,
    ),
  });
  listing = new ListStationOutcomesHandler(
    new OutcomesAccess({
      namesOf: async () => new Map(),
      membershipOnTeam: async (_teamId, principal) =>
        principal.userId.equals(UserId.of('user_ada'))
          ? { workspaceId: WorkspaceId.of(WORKSPACE), by: principal.userId }
          : null,
    }),
    records,
    deliveries,
    configPullRequests,
    work,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('how a station’s runs turned out', () => {
  it('records an ended run with its config and round', async () => {
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
    expect(record?.end?.round).toBe(1);
    expect(record?.end?.endedAt).toEqual(at(9));
  });

  it('attaches the first thing a person did after the run', async () => {
    await deliver('outcomes.record-next-person-act', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      stationId: 'station_1',
      act: 'sent-back',
      by: 'user_ada',
      after: null,
      at: at(10).toISOString(),
    });
    await deliver('outcomes.record-next-person-act', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      stationId: 'station_1',
      act: 'closed',
      by: 'user_ada',
      after: 'run_1',
      at: at(10).toISOString(),
    });

    const record = await records.of(RunId.of('run_1'));
    expect(record?.next?.act).toBe('sent-back');
    expect(record?.next?.at).toEqual(at(10));
  });

  it('attaches checks heard before and after the run ended', async () => {
    await deliver('outcomes.record-checked-change', {
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
      round: 2,
    });
    await runEnded('run_2');
    await deliver('outcomes.record-checked-change', {
      kind: CHANGE_CHECKED,
      runId: 'run_1',
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      passed: false,
    });

    expect((await records.of(RunId.of('run_2')))?.checks).toBe('passed');
    expect((await records.of(RunId.of('run_2')))?.end?.round).toBe(2);
    expect((await records.of(RunId.of('run_1')))?.checks).toBe('failed');
  });

  it('follows the task’s pull request from opened to merged', async () => {
    await deliver('outcomes.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      teamId: 'team_1',
      url: PULL,
      at: at(12).toISOString(),
    });
    await deliver('outcomes.record-closed-pull-request', {
      kind: PULL_REQUEST_CLOSED,
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      repository: 'acme/api',
      closedAt: at(13).toISOString(),
      merged: true,
      mergeCommit: 'c0ffee',
    });

    const outcomes = await new RunOutcomes(records, deliveries).of(
      ['run_1', 'run_2'],
      null,
    );

    expect(outcomes.get('run_1')?.delivery).toBe('merged');
    expect(outcomes.get('run_2')).toMatchObject({
      fingerprint: OPUS,
      ending: 'completed',
      round: 2,
      checks: 'passed',
      delivery: 'merged',
    });
  });

  it('groups the station’s runs at each config change in start order, the newest first, keeping a run withdrawn before it ran another config apart from the group in force', async () => {
    endedRun('run_3', {
      startedAt: at(11),
      endedAt: at(12),
      fingerprint: OPUS,
      taskId: 'task_2',
    });
    await runEnded('run_3', { stopped: true });
    endedRun('run_withdrawn', {
      endedAt: new Date('2026-09-30T10:30:00.000Z'),
      fingerprint: SONNET,
    });
    await runEnded('run_withdrawn', { outcome: 'withdrawn' });
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
        firstRunId: 'run_withdrawn',
        fingerprint: SONNET,
        ran: false,
        model: 'sonnet',
        changes: [['opus', 'sonnet']],
        runs: [['run_withdrawn', 'withdrawn']],
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
      withdrawn: 1,
    });
    expect(outcomes.groups[1]?.tally).toMatchObject({
      runs: 1,
      withdrawn: 0,
      stopped: 1,
      cost: { amount: 0.4, currency: 'USD' },
    });
    expect(outcomes.groups[3]?.tally).toMatchObject({
      runs: 1,
      withdrawn: 0,
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
      tally: expect.objectContaining({ runs: 1, withdrawn: 0 }),
    });
  });

  it('shows on each group the latest pull request Spotlight opened proposing its config at the station, and none on a config it proposed nowhere', async () => {
    const opened = (
      id: string,
      fingerprint: string,
      hour: number,
      stationId = 'station_1',
    ) =>
      deliver('outcomes.record-opened-config-pull-request', {
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
      ['run_withdrawn', null],
      ['run_2', { url: 'https://github.com/acme/platform/pull/42' }],
      ['run_1', null],
    ]);
  });

  it('carries on the config of the station’s last config run before the oldest listed run, setting the oldest group against it', async () => {
    const lastOf = async (last: number) =>
      (
        await listing.execute(
          new ListStationOutcomesQuery(
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

  it('refuses to write over a record that changed since it was read', async () => {
    const read = await records.of(RunId.of('run_3'));

    if (!read) {
      throw new Error('not stored');
    }

    await records.save(read.recordCheck('passed', HEARD_AT));

    await expect(
      records.save(read.recordCheck('failed', HEARD_AT)),
    ).rejects.toBeInstanceOf(RunRecordVersionConflictError);
  });

  it('forgets a deleted task’s runs and delivery', async () => {
    const deleted = {
      kind: TASK_DELETED,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
    };

    await deliver('outcomes.record-next-person-act', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      stationId: 'station_1',
      act: 'answered',
      by: 'user_ada',
      after: 'run_9',
      at: at(14).toISOString(),
    });
    expect(await records.of(RunId.of('run_9'))).not.toBeNull();

    await deliver('outcomes.forget-runs-of-deleted-task', deleted);
    await deliver('outcomes.forget-delivery-of-deleted-task', deleted);

    expect(await records.of(RunId.of('run_1'))).toBeNull();
    expect(await records.of(RunId.of('run_9'))).toBeNull();
    expect(await records.of(RunId.of('run_3'))).not.toBeNull();
    expect((await list()).groups.flatMap((each) => each.runs)).toHaveLength(1);
  });

  it('records nothing more of a deleted task, however late it is heard of', async () => {
    await deliver('outcomes.record-next-person-act', {
      kind: TASK_ACTED_ON,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      stationId: 'station_1',
      act: 'answered',
      by: 'user_ada',
      after: 'run_10',
      at: at(15).toISOString(),
    });
    await deliver('outcomes.record-opened-pull-request', {
      kind: PULL_REQUEST_OPENED,
      taskId: 'task_1',
      workspaceId: WORKSPACE,
      teamId: 'team_1',
      url: 'https://github.com/acme/api/pull/99',
      at: at(15).toISOString(),
    });

    expect(await records.of(RunId.of('run_10'))).toBeNull();
    expect(await deliveries.forTask(TaskId.of('task_1'))).toBeNull();
  });

  it('records nothing of a task heard of while its forgetting is under way, once the forgetting commits', async () => {
    let locked: () => void = () => {};
    let release: () => void = () => {};
    const forgettingLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const forgetting = context.inTransaction(async () => {
      await forgotten.forgetTask(
        WorkspaceId.of(WORKSPACE),
        TaskId.of('task_9'),
      );
      locked();
      await released;
    });
    await forgettingLocked;

    const noting = deliver('outcomes.record-next-person-act', {
      kind: TASK_ACTED_ON,
      taskId: 'task_9',
      workspaceId: WORKSPACE,
      stationId: 'station_1',
      act: 'answered',
      by: 'user_ada',
      after: 'run_90',
      at: at(16).toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    release();
    await forgetting;
    await noting;

    expect(await records.of(RunId.of('run_90'))).toBeNull();
  });

  it('records nothing more of a disbanded team, however late it is heard of', async () => {
    await deliver('outcomes.forget-chats-of-disbanded-team', {
      kind: TEAM_DISBANDED,
      workspaceId: WORKSPACE,
      teamId: 'team_gone',
      key: 'gone',
    });

    await deliver('outcomes.record-started-chat', {
      kind: CHAT_STARTED,
      chatId: 'chat_gone',
      workspaceId: WORKSPACE,
      teamId: 'team_gone',
      by: 'user_ada',
      at: at(16).toISOString(),
    });

    expect(await chats.of('chat_gone')).toBeNull();
  });

  it('keeps no config pull request of a disbanded team heard of late', async () => {
    endedRun('run_disbanded', {
      teamId: 'team_disbanded',
      taskId: 'task_disbanded',
      fingerprint: OPUS,
      startedAt: at(16),
      endedAt: at(17),
    });
    await runEnded('run_disbanded');

    await deliver('outcomes.forget-config-pull-requests-of-disbanded-team', {
      kind: TEAM_DISBANDED,
      workspaceId: WORKSPACE,
      teamId: 'team_disbanded',
      key: 'disbanded',
    });
    await configPullRequestOpened(WORKSPACE, 'team_disbanded', '51');

    const outcomes = await listAt(WORKSPACE, 'team_disbanded');

    expect(outcomes.groups.map((group) => group.pullRequest)).toEqual([null]);
  });

  it('keeps no config pull request of a closed workspace heard of late', async () => {
    endedRun('run_closed', {
      workspaceId: 'ws_closed',
      teamId: 'team_closed',
      taskId: 'task_closed',
      fingerprint: OPUS,
      startedAt: at(16),
      endedAt: at(17),
    });
    await runEnded('run_closed', { workspaceId: 'ws_closed' });

    await deliver('outcomes.forget-config-pull-requests-of-closed-workspace', {
      kind: WORKSPACE_CLOSED,
      workspaceId: 'ws_closed',
      slug: 'closed',
    });
    await configPullRequestOpened('ws_closed', 'team_closed', '52');

    const outcomes = await listAt('ws_closed', 'team_closed');

    expect(outcomes.groups.map((group) => group.pullRequest)).toEqual([null]);
  });
});

describe('the config runs a station’s runs make', () => {
  let stretches: DrizzleRunRecordRepository;
  const plannedRuns: string[] = [];

  interface Planned {
    readonly runId: string;
    readonly fingerprint: string | null;
    readonly startedAt: Date | null;
    readonly endedAt: Date;
    readonly outcome?: 'withdrawn' | 'failed';
  }

  const minute = (minutes: number) =>
    new Date(Date.UTC(2026, 9, 1, 9, minutes));

  const planned = (
    runId: string,
    fingerprint: string | null,
    startedAt: number | null,
    change: { endedAt?: number; outcome?: 'withdrawn' | 'failed' } = {},
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
    const noting = new NoteRunEnded(work, stretches, forgotten, context, QUIET);

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
    stretches = new DrizzleRunRecordRepository(
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
      planned('unstarted_withdrawn', OPUS, null, {
        endedAt: 2,
        outcome: 'withdrawn',
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
      bounds: readonly StretchBound[],
      teamId = 'team_1',
    ) => {
      const fromSql = (
        await context.inTransaction(() =>
          stretches.lastConfigRunsBefore(TeamId.of(teamId), bounds),
        )
      )
        .map((each) => each.runId.value)
        .sort();
      const records = await stretches.ofRuns(
        plannedRuns.map((each) => RunId.of(each)),
      );
      const fromDomain = lastConfigRunsFrom(
        records.filter((each) => each.end?.place.teamId.value === teamId),
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
        new ListStationOutcomesQuery(
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
