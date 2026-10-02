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
import { NotePersonAct } from '@outcomes/application/services/note-person-act.service';
import { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import { NotePullRequestRecords } from '@outcomes/application/services/note-pull-request-records.service';
import { NotePullRequestReviewed } from '@outcomes/application/services/note-pull-request-reviewed.service';
import { NoteRunDigested } from '@outcomes/application/services/note-run-digested.service';
import { NoteRunEnded } from '@outcomes/application/services/note-run-ended.service';
import { NoteRunHandedOn } from '@outcomes/application/services/note-run-handed-on.service';
import { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import { NoteTaskFailed } from '@outcomes/application/services/note-task-failed.service';
import { NoteTaskTouch } from '@outcomes/application/services/note-task-touch.service';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import { RunOutcomes } from '@outcomes/application/services/run-outcomes.service';
import { WatchStations } from '@outcomes/application/services/watch-stations.service';
import { RunRecordMovedOnError } from '@outcomes/domain/exceptions/run-record-moved-on.error';
import { DrizzleForgotten } from '@outcomes/infrastructure/persistence/drizzle/ledgers/forgotten.ledger';
import { DrizzlePendingReviews } from '@outcomes/infrastructure/persistence/drizzle/ledgers/pending-reviews.ledger';
import { DrizzleChangeJudgingRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/change-judging.repository';
import { DrizzleChatRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/chat-record.repository';
import { DrizzleJudgingRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/judging.repository';
import { DrizzlePullRequestRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import { DrizzleRunRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleScoreRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/score.repository';
import { DrizzleStationWatchRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/station-watch.repository';
import { DrizzleTaskChangeShapeRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-change-shape.repository';
import { DrizzleTaskDeliveryRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-delivery.repository';
import { DrizzleTaskFailuresRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import { DrizzleTaskTouchesRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-touches.repository';
import { outcomesSubscribers } from '@outcomes/presentation/events/outcomes.subscribers';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { CHANGE_CHECKED } from '@shared-kernel/application/integration-events/change-checked.integration-event';
import { CHAT_STARTED } from '@shared-kernel/application/integration-events/chat-started.integration-event';
import { PULL_REQUEST_CLOSED } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import { PULL_REQUEST_OPENED } from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import { RUN_DIGESTED } from '@shared-kernel/application/integration-events/run-digested.integration-event';
import { RUN_ENDED } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { TASK_ACTED_ON } from '@shared-kernel/application/integration-events/task-acted-on.integration-event';
import { TASK_DELETED } from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import { TEAM_DISBANDED } from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { DomainEventSubscriber } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
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

let held: TestDatabase;
let records: DrizzleRunRecordRepository;
let deliveries: DrizzleTaskDeliveryRepository;
let subscribers: readonly DomainEventSubscriber[];
let listing: ListStationOutcomesHandler;
let context: DrizzleContext;
let forgotten: DrizzleForgotten;
let chats: DrizzleChatRecordRepository;

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

beforeAll(async () => {
  held = await openDatabase('station_outcomes');
  context = new DrizzleContext(held.db);
  const quiet = {
    dispatch: async () => {},
  } as unknown as DomainEventDispatcher;
  records = new DrizzleRunRecordRepository(context, quiet);
  deliveries = new DrizzleTaskDeliveryRepository(context, quiet);
  const judgings = new DrizzleJudgingRepository(context, quiet);
  const scores = new DrizzleScoreRepository(context, quiet);
  const touches = new DrizzleTaskTouchesRepository(context);
  const failures = new DrizzleTaskFailuresRepository(context);
  chats = new DrizzleChatRecordRepository(context);
  const pullRequests = new DrizzlePullRequestRecordRepository(context);
  const shapes = new DrizzleTaskChangeShapeRepository(context);
  const watches = new DrizzleStationWatchRepository(context, quiet);
  const reviews = new DrizzlePendingReviews(context);
  forgotten = new DrizzleForgotten(context);
  subscribers = outcomesSubscribers({
    ending: new NoteRunEnded(work, records, forgotten, context),
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
        scores,
        touches,
        failures,
        chats,
        pullRequests,
        shapes,
        watches,
        reviews,
        forgotten,
      },
      context,
    ),
    judging: new AskForJudging(
      work,
      {
        holds: async () => true,
        of: async () => null,
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
  });
  listing = new ListStationOutcomesHandler(
    new OutcomesAccess({
      namesOf: async () => new Map(),
      clearedOnTeam: async (_teamId, principal) =>
        principal.userId.equals(UserId.of('user_ada'))
          ? { workspaceId: WorkspaceId.of(WORKSPACE), by: principal.userId }
          : null,
    }),
    records,
    deliveries,
    work,
  );
}, 60_000);

afterAll(async () => {
  await held?.close();
});

describe('how a station’s runs turned out', () => {
  it('records an ended run with its config and round', async () => {
    endedRun('run_1', { endedAt: at(9), fingerprint: SONNET });

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
    endedRun('run_2', { endedAt: at(11), fingerprint: OPUS, round: 2 });
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

  it('groups the station’s runs by config, the newest first', async () => {
    endedRun('run_3', { endedAt: at(12), fingerprint: OPUS, taskId: 'task_2' });
    await runEnded('run_3', { stopped: true });

    const outcomes = await list();

    expect(
      outcomes.groups.map((group) => ({
        fingerprint: group.fingerprint,
        model: group.config?.model,
        changes: group.changes.map((each) => [each.was, each.now]),
        runs: group.runs.map((each) => [each.runId, each.ending]),
        tally: group.tally,
      })),
    ).toEqual([
      {
        fingerprint: OPUS,
        model: 'opus',
        changes: [['sonnet', 'opus']],
        runs: [
          ['run_3', 'stopped'],
          ['run_2', 'completed'],
        ],
        tally: {
          runs: 2,
          withdrawn: 0,
          failed: 0,
          stopped: 1,
          checksPassed: 1,
          checksFailed: 0,
          accepted: 0,
          sentBack: 0,
          handedOn: 0,
          merged: 1,
          cost: { amount: 0.8, currency: 'USD' },
          unpriced: 0,
          mixedCurrencies: false,
          medianMs: 60_000,
          p90Ms: 60_000,
        },
      },
      {
        fingerprint: SONNET,
        model: 'sonnet',
        changes: [],
        runs: [['run_1', 'failed']],
        tally: {
          runs: 1,
          withdrawn: 0,
          failed: 1,
          stopped: 0,
          checksPassed: 0,
          checksFailed: 1,
          accepted: 0,
          sentBack: 1,
          handedOn: 0,
          merged: 1,
          cost: { amount: 0.4, currency: 'USD' },
          unpriced: 0,
          mixedCurrencies: false,
          medianMs: 60_000,
          p90Ms: 60_000,
        },
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

    await records.save(read.checked('passed', HEARD_AT));

    await expect(
      records.save(read.checked('failed', HEARD_AT)),
    ).rejects.toBeInstanceOf(RunRecordMovedOnError);
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
    const forgettingHolds = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const forgetting = context.run(async () => {
      await forgotten.forgetTask(
        WorkspaceId.of(WORKSPACE),
        TaskId.of('task_9'),
      );
      locked();
      await released;
    });
    await forgettingHolds;

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
});
