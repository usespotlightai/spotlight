import {
  pullRequestsStoredIn,
  runsListedIn,
  storedCarriedOf,
  storedHistoryOf,
} from '@insights/application/ports/insights-reader.fake-spec';
import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import {
  TeamScopes,
  windowOf,
} from '@insights/application/services/team-scopes.service';
import { ChatRecord } from '@insights/domain/aggregates/chat-record.aggregate';
import {
  type BotActivity,
  PullRequestRecord,
  type SeenPullRequest,
} from '@insights/domain/aggregates/pull-request-record.aggregate';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { Score } from '@insights/domain/aggregates/score.aggregate';
import { TaskChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import {
  agentConfigCountsOf,
  agentConfigRunsWithin,
} from '@insights/domain/services/agent-config-comparison';
import { changeCountsOf } from '@insights/domain/services/before-after';
import {
  type CostCounts,
  type CostPlace,
  costBreakdownFrom,
  costCountsOf,
} from '@insights/domain/services/cost-breakdown';
import { flowCountsOf, flowFrom } from '@insights/domain/services/flow';
import { judgedRunsOf } from '@insights/domain/services/judge-rates';
import { memoryCountsOf } from '@insights/domain/services/memory-comparison';
import { overviewCountsOf } from '@insights/domain/services/overview-counts';
import { peopleCountsOf } from '@insights/domain/services/people-counts';
import {
  filteredPullRequests,
  type PullRequestFilter,
} from '@insights/domain/services/pull-request-filter';
import {
  pullRequestCountsOf,
  pullRequestInsightsFrom,
  weekOf,
  weekWindowOf,
} from '@insights/domain/services/pull-request-insights';
import {
  HARNESS_DEFAULT_MODEL,
  NO_REPOSITORY,
  NO_SERVER,
  type RunFilterQuery,
  runFilterOf,
} from '@insights/domain/services/run-filter';
import { RUN_SIZES, type RunSize } from '@insights/domain/services/run-size';
import {
  pipelineCountsOf,
  type Stage,
  shippedTaskIdsOf,
  shippingCountsOf,
  type Timed,
} from '@insights/domain/services/shipping';
import {
  stationReportsFrom,
  teamCountsOf,
  teamReportFrom,
} from '@insights/domain/services/station-reports';
import {
  openingsOf,
  type TeamHistory,
} from '@insights/domain/services/team-history';
import { toolCountsOf } from '@insights/domain/services/tool-insights';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import {
  HumanAction,
  TASK_ACTIONS,
} from '@insights/domain/value-objects/human-action.vo';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import {
  dayOf,
  INSIGHTS_PERIODS,
  InsightsPeriod,
} from '@insights/domain/value-objects/insights-period.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { Refusal } from '@insights/domain/value-objects/refusal.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { MEMORY_VIAS } from '@insights/domain/value-objects/run-memories.vo';
import {
  RunTools,
  type ServerCalls,
} from '@insights/domain/value-objects/run-tools.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import {
  metRate,
  SCORE_KINDS,
  ScoreScale,
} from '@insights/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import { TaskHumanAction } from '@insights/domain/value-objects/task-human-action.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { DrizzleRunFactProjection } from '@insights/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { DrizzleInsightsReader } from '@insights/infrastructure/persistence/drizzle/readers/insights.reader';
import { DrizzleChatRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/chat-record.repository';
import { DrizzlePullRequestRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleScoreRepository } from '@insights/infrastructure/persistence/drizzle/repositories/score.repository';
import { DrizzleTaskChangeShapeRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-change-shape.repository';
import { DrizzleTaskFailuresRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import { DrizzleTaskHumanActionsRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-human-actions.repository';
import { DrizzleTaskPullRequestRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-pull-request.repository';
import type { Env } from '@platform/config/env.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DrizzleReading } from '@platform/persistence/drizzle/drizzle.reading';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import {
  historyRepositoriesOf,
  pullRequestRepositoriesOf,
  type ReferenceRepositories,
} from './support/insights-reference';

const WORKSPACE = WorkspaceId.of('workspace_parity');
const TEAM = TeamId.of('team_parity');
const VIEWER = UserId.of('user_ada');

const NEXT_DOOR = TeamId.of('team_next_door');

const HOMES = [
  { workspaceId: WORKSPACE, teamId: TEAM },
  { workspaceId: WORKSPACE, teamId: NEXT_DOOR },
  {
    workspaceId: WorkspaceId.of('workspace_elsewhere'),
    teamId: TeamId.of('team_elsewhere'),
  },
  { workspaceId: WorkspaceId.of('workspace_elsewhere'), teamId: TEAM },
] as const;
const NOW = new Date('2026-10-14T15:00:00.000Z');
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const RUNS = 600;

const STATIONS = [
  { lineId: 'line_a', stationId: 'plan' },
  { lineId: 'line_a', stationId: 'build' },
  { lineId: 'line_b', stationId: 'review' },
  { lineId: 'line_b', stationId: 'ship' },
] as const;

const PEOPLE = ['user_ada', 'user_bob', 'user_cy', 'user_dee', 'user_eve'];

const FAR = 'user_far';

const GUS = 'user_gus';

const REPOSITORIES = [
  [],
  ['acme/api'],
  ['acme/api'],
  ['acme/api', 'acme/web'],
  ['acme/web', 'acme/api', 'acme/docs'],
];

const CHATS = 40;

const ELSEWHERE_ONLY = { lineId: 'line_c', stationId: 'elsewhere_only' };

const ENDINGS: readonly RunEnding[] = [
  'completed',
  'completed',
  'completed',
  'failed',
  'stopped',
  'exhausted',
  'cancelled',
];

const seeded = (seed: number) => {
  let state = seed;

  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
};

const SEED = 187;
const random = seeded(SEED);
const pick = <T>(from: readonly T[]): T =>
  from[Math.floor(random() * from.length)] as T;
const chance = (share: number): boolean => random() < share;
const toolRandom = seeded(SEED * 7 + 1);
const toolPick = <T>(from: readonly T[]): T =>
  from[Math.floor(toolRandom() * from.length)] as T;
const toolChance = (share: number): boolean => toolRandom() < share;
const upTo = (max: number): number => Math.floor(toolRandom() * (max + 1));

const agentConfigRandom = seeded(SEED * 17 + 3);
const agentConfigPick = <T>(from: readonly T[]): T =>
  from[Math.floor(agentConfigRandom() * from.length)] as T;
const RUBRICS = ['a'.repeat(64), 'b'.repeat(64)];

const prRandom = seeded(SEED * 19 + 7);
const prPick = <T>(from: readonly T[]): T =>
  from[Math.floor(prRandom() * from.length)] as T;
const PULL_REQUESTS = 600;
const PR_REPOSITORIES = ['acme/api', 'acme/web', 'Acme/API', 'other/tool'];
const PR_TITLES = [
  'Fix the login',
  'feat(api): add uploads',
  'Refactor the queue',
  'Bump lodash',
  'Write tests for retries',
  'Retry failed uploads',
  'docs: explain setup',
];
const shaped = new Set<string>();

const SKILLS = [[], ['grafana'], ['grafana', 'release-notes'], ['deploy']];
const READ = ['grafana', 'release-notes', 'deploy', 'Search'];
const SERVERS = ['linear', 'github', 'sentry'];

const callsTo = (server: string): ServerCalls => {
  const calls = 1 + upTo(3);
  const unfinished = toolChance(0.2) ? 1 : 0;
  const failed = Math.min(calls, unfinished + upTo(1));

  return {
    server,
    calls,
    failed,
    latency: LatencyHistogram.timing(
      Array.from({ length: calls - unfinished }, () =>
        Math.floor(toolRandom() * 3_000),
      ),
    ),
    lastCallFailed: failed > 0 && toolChance(0.6),
  };
};

const toolsOfRun = (): RunTools =>
  RunTools.of({
    servers: SERVERS.filter(() => toolChance(0.35)).map(callsTo),
    skillsRead: READ.filter(() => toolChance(0.25)),
  });

const memoryRandom = seeded(SEED * 13 + 5);
const MEMORIES = ['mem_a', 'mem_b', 'mem_c', 'mem_d'];

const rememberedIn = (record: RunRecord): RunRecord =>
  MEMORY_VIAS.reduce(
    (remembered, way) =>
      memoryRandom() < 0.35
        ? remembered.recordMemories(
            way,
            MEMORIES.filter(() => memoryRandom() < 0.4),
          )
        : remembered,
    record,
  );

const refusedIn = (record: RunRecord, endedAt: Date): RunRecord => {
  let refused = record;

  for (let each = upTo(2); each > 0; each -= 1) {
    refused = refused.refused(
      Refusal.of({
        tool: toolPick(['create_issue', 'merge', 'Deploy']),
        server: toolPick(['linear', 'github', null]),
        at: new Date(endedAt.getTime() - each * 60_000),
      }),
    );
  }

  return refused;
};
const NO_RUN_FILTER: RunFilterQuery = {
  lineId: null,
  stationId: null,
  outcome: null,
  harness: null,
  model: null,
  repository: null,
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
  refusedTool: null,
  refusedServer: null,
  pullRequestState: null,
  humanAction: null,
  asked: null,
};

const ago = (ms: number): Date => new Date(NOW.getTime() - ms);

const inPlaceOrder = (
  a: { readonly first: CostPlace },
  b: { readonly first: CostPlace },
): number => a.first.run - b.first.run || a.first.offset - b.first.offset;

const ordered = (counts: CostCounts): CostCounts => ({
  ...counts,
  shares: [...counts.shares].sort(
    (a, b) => a.part.localeCompare(b.part) || inPlaceOrder(a, b),
  ),
  links: [...counts.links].sort(inPlaceOrder),
  cacheByStation: [...counts.cacheByStation].sort((a, b) => a.first - b.first),
});

let database: TestDatabase;
let scopes: TeamScopes;
let reader: DrizzleInsightsReader;
let humanActions: DrizzleTaskHumanActionsRepository;
let taskPullRequests: DrizzleTaskPullRequestRepository;
let failures: DrizzleTaskFailuresRepository;
let chats: DrizzleChatRecordRepository;
let scores: DrizzleScoreRepository;
let runs: DrizzleRunRecordRepository;
let pullRequests: DrizzlePullRequestRecordRepository;
let shapes: DrizzleTaskChangeShapeRepository;

const referenceRepositories = (): ReferenceRepositories => ({
  db: database.db,
  runs,
  taskPullRequests,
  humanActions,
  failures,
  chats,
  pullRequests,
  shapes,
});

const historyOver = async (
  teamId: string,
  principal: Principal,
  name: string,
) => {
  const { access, period } = await scopes.scope(teamId, principal, name);
  const team = {
    workspaceId: access.workspaceId,
    teamId: access.teamId,
    period,
  };

  return {
    access,
    period,
    team,
    history: await storedHistoryOf(
      historyRepositoriesOf(referenceRepositories()),
      team,
    ),
  };
};

const carriedOver = (over: {
  readonly team: TeamInPeriod;
  readonly history: TeamHistory;
}) =>
  storedCarriedOf(
    historyRepositoriesOf(referenceRepositories()),
    over.team,
    over.history,
  );

beforeAll(async () => {
  database = await openDatabase('insights_parity');
  const context = new DrizzleContext(database.db);
  const quiet = {
    dispatch: async () => {},
  } as unknown as DomainEventDispatcher;
  const facts = new DrizzleRunFactProjection(context);
  const records = new DrizzleRunRecordRepository(context, facts, quiet);
  taskPullRequests = new DrizzleTaskPullRequestRepository(
    context,
    facts,
    quiet,
  );
  humanActions = new DrizzleTaskHumanActionsRepository(context, facts);
  failures = new DrizzleTaskFailuresRepository(context);
  chats = new DrizzleChatRecordRepository(context);
  runs = records;
  pullRequests = new DrizzlePullRequestRecordRepository(context);
  shapes = new DrizzleTaskChangeShapeRepository(context);
  scores = new DrizzleScoreRepository(context, quiet);

  scopes = new TeamScopes(
    new InsightsAccess({
      namesOf: async () => new Map(),
      membershipOnTeam: async () => ({ workspaceId: WORKSPACE, by: VIEWER }),
    }),
    { now: () => NOW, sleep: async () => {} },
  );
  reader = new DrizzleInsightsReader(
    new DrizzleReading(database.db, {
      DATABASE_READ_TIMEOUT_MS: 15_000,
    } as Env),
  );

  await context.inTransaction(async () => {
    let home = HOMES[0];

    for (let index = 0; index < RUNS; index += 1) {
      if (index % 2 === 0) {
        home = chance(0.75) ? HOMES[0] : pick(HOMES.slice(1));
      }

      const station =
        home === HOMES[3] || (home !== HOMES[0] && chance(0.5))
          ? ELSEWHERE_ONLY
          : pick(STATIONS);
      const taskId = TaskId.of(`task_${Math.floor(index / 2)}`);
      const endedAt = ago(Math.floor(random() * 200 * DAY));
      const startedAt = chance(0.9)
        ? new Date(endedAt.getTime() - Math.floor(random() * 2 * HOUR))
        : null;
      let record = RunRecord.empty(
        RunId.of(`run_${String(index).padStart(4, '0')}`),
        home.workspaceId,
      ).recordEnd(
        RunEnd.of({
          location: RunLocation.of({ teamId: home.teamId, ...station, taskId }),
          fingerprint: pick(['a'.repeat(64), 'b'.repeat(64)]),
          agentConfig: RunAgentConfig.of({
            harness: pick(['claude-code', 'codex']),
            model: pick(['opus', 'sonnet', null]),
            effort: agentConfigPick([null, null, 'high']),
            profileKey: agentConfigPick([null, null, 'fast']),
            repositories: pick(REPOSITORIES),
            skills: toolPick(SKILLS),
          }),
          queuedAt: startedAt ? new Date(startedAt.getTime() - HOUR) : null,
          startedAt,
          endedAt,
          ending: pick(ENDINGS),
          failure: pick(['exited', 'timed-out', null]),
          visit: 1,
          asked: chance(0.2),
        }),
      );

      if (chance(0.75)) {
        record = record.recordUsage(
          RunUsage.of({
            ms: chance(0.9) ? Math.floor(random() * 3_600_000) : null,
            steps: agentConfigPick([3, 20, 21, 80, 81]),
            errors: 0,
            changedLines: agentConfigPick([0, 0, 10, 50, 51, 400, 401]),
            contextTokens: null,
            contextWindow: null,
            amount: chance(0.85) ? Math.round(random() * 1000) / 100 : null,
            currency:
              station.stationId === 'ship' &&
              endedAt.getTime() < ago(60 * DAY).getTime() &&
              chance(0.3)
                ? 'EUR'
                : 'USD',
            tokens: {
              input: chance(0.9) ? Math.floor(random() * 10_000) : null,
              output: 10,
              cacheRead:
                station.stationId !== 'review' && chance(0.7)
                  ? Math.floor(random() * 50_000)
                  : null,
              cacheWrite: chance(0.5) ? Math.floor(random() * 5_000) : null,
            },
          }),
          toolsOfRun(),
        );
      }
      if (chance(0.5)) {
        record = record.recordCheck(
          pick(['passed', 'failed', 'skipped'] as const),
          endedAt,
        );
      }
      if (chance(0.5)) {
        record = record.recordAction(
          HumanAction.of(
            pick(['started', 'parked', 'accepted', 'answered', 'sent-back']),
            new Date(endedAt.getTime() + HOUR),
          ),
        );
      }
      if (chance(0.1)) {
        record = record.passTo(
          StationPass.of('ship', new Date(endedAt.getTime() + 2 * HOUR)),
        );
      }
      if (chance(0.1)) {
        record = record.supersededByItsTask(
          new Date(endedAt.getTime() + 3 * HOUR),
        );
      }

      record = rememberedIn(refusedIn(record, endedAt));

      await records.add(record);

      for (const rubricVersion of RUBRICS) {
        if (agentConfigRandom() < 0.4) {
          const kind = agentConfigPick(SCORE_KINDS);
          const claimResults =
            kind === 'claims'
              ? Array.from(
                  { length: agentConfigPick([1, 2, 3, 4]) },
                  () => agentConfigRandom() < 0.5,
                )
              : null;

          await scores.add(
            Score.judge({
              id: ScoreId.of(`score_${index}_${rubricVersion.slice(0, 1)}`),
              runId: record.runId,
              workspaceId: home.workspaceId,
              location: RunLocation.of({
                teamId: home.teamId,
                ...(agentConfigRandom() < 0.1
                  ? agentConfigPick(STATIONS)
                  : station),
                taskId,
              }),
              fingerprint: null,
              scale: ScoreScale.of(kind),
              value: claimResults
                ? metRate(claimResults)
                : kind === 'yes-no'
                  ? agentConfigPick([0, 1])
                  : agentConfigPick([1, 2, 3, 4, 5]),
              claimResults,
              rubricVersion,
              model: 'judge/model',
              reasons: (claimResults ?? [true]).map((_, at) =>
                JudgeReason.of({
                  text: `Reason ${at}.`,
                  citations: [Citation.ofStep(1)],
                  claim: claimResults ? at : null,
                }),
              ),
              seen: SeenEvidence.none(),
              at: endedAt,
            }),
          );
        }
      }

      if (index % 2 === 0) {
        const far = chance(0.15);
        const person = () => UserId.of(far ? FAR : pick(PEOPLE));
        let taskActions = TaskHumanActions.empty(
          taskId,
          home.workspaceId,
        ).recordOpen(
          TaskOpening.of({
            teamId: far ? NEXT_DOOR : home.teamId,
            lineId: station.lineId,
            stationId: station.stationId,
            by: chance(0.9) ? person() : null,
            at: new Date(endedAt.getTime() - (chance(0.1) ? 150 * DAY : DAY)),
          }),
        );

        for (let acted = Math.floor(random() * 4); acted > 0; acted -= 1) {
          taskActions = taskActions.recordAction(
            TaskHumanAction.of({
              kind: pick([...TASK_ACTIONS, 'approved', 'refused'] as const),
              by: person(),
              stationId: station.stationId,
              at: ago(Math.floor(random() * 200 * DAY)),
            }),
          );
        }

        for (let asked = Math.floor(random() * 3); asked > 0; asked -= 1) {
          taskActions = taskActions.asked(
            InboxAsk.of(
              pick([station.stationId, pick(STATIONS).stationId]),
              ago(Math.floor(random() * 200 * DAY)),
            ),
          );
        }

        await humanActions.add(taskActions);

        if (chance(0.5)) {
          const pullRequest = PullRequestUrl.of(
            `https://github.com/acme/api/pull/${index}`,
          );
          const fresh = TaskPullRequest.open({
            taskId,
            workspaceId: home.workspaceId,
            teamId: far ? NEXT_DOOR : home.teamId,
            pullRequest,
            at: new Date(endedAt.getTime() - HOUR),
          });
          const opened = chance(0.6)
            ? fresh.recordReview({
                pullRequest,
                byBot: false,
                at: new Date(
                  endedAt.getTime() + Math.floor(random() * 20) * HOUR,
                ),
              })
            : fresh;

          await taskPullRequests.add(
            chance(0.6)
              ? opened.close({
                  pullRequest,
                  merged: chance(0.7),
                  at: new Date(endedAt.getTime() + DAY),
                })
              : opened,
          );
        }

        if (chance(0.3)) {
          let failed = TaskFailures.empty(
            taskId,
            home.workspaceId,
            home.teamId,
          );

          for (
            let raised = 0;
            raised < 1 + Math.floor(random() * 3);
            raised++
          ) {
            failed = failed.raise(
              FailureOccurrence.of({
                stationId: chance(0.1) ? 'deleted_station' : station.stationId,
                runId: null,
                source: pick(['run', 'hook:deploy']),
                code: pick(['exited', 'timed-out', 'refused']),
                occurrences: 1 + Math.floor(random() * 4),
                at: ago(Math.floor(random() * 100 * DAY)),
              }),
            );
          }

          await failures.add(failed);
        }
      }
    }

    for (let index = 0; index < CHATS; index += 1) {
      const where = pick(HOMES);

      await chats.add(
        ChatRecord.start({
          chatId: `chat_${index}`,
          workspaceId: where.workspaceId,
          teamId: where.teamId,
          startedBy: UserId.of(pick(PEOPLE)),
          startedAt: ago(Math.floor(random() * 200 * DAY)),
        }),
      );
    }

    const tied = ago(2 * DAY);

    for (const [runId, endedAt, beganHoursBefore, station, model, currency] of [
      ['run_tie_a', tied, 1, STATIONS[0], 'haiku', 'USD'],
      ['run_tie_b', tied, 3, STATIONS[1], 'gpt', 'USD'],
      ['run_euro', ago(75 * DAY), 1, STATIONS[3], 'sonnet', 'EUR'],
    ] as const) {
      await records.add(
        RunRecord.empty(RunId.of(runId), WORKSPACE)
          .recordEnd(
            RunEnd.of({
              location: RunLocation.of({
                teamId: TEAM,
                ...station,
                taskId: TaskId.of(`task_${runId}`),
              }),
              fingerprint: 'a'.repeat(64),
              agentConfig: RunAgentConfig.of({
                harness: 'claude-code',
                model,
                effort: null,
                profileKey: null,
                repositories: [`acme/${runId}`],
                skills: [],
              }),
              queuedAt: null,
              startedAt: new Date(endedAt.getTime() - beganHoursBefore * HOUR),
              endedAt,
              ending: 'completed',
              failure: null,
              visit: 1,
              asked: false,
            }),
          )
          .recordUsage(
            RunUsage.of({
              ms: 1_000,
              steps: 1,
              errors: 0,
              changedLines: 1,
              contextTokens: null,
              contextWindow: null,
              amount: 0.5,
              currency,
              tokens: {
                input: 1,
                output: 1,
                cacheRead: 1,
                cacheWrite: null,
              },
            }),
            RunTools.NONE,
          ),
      );
    }

    await humanActions.add(
      TaskHumanActions.empty(TaskId.of('task_both_windows'), WORKSPACE)
        .recordOpen(
          TaskOpening.of({
            teamId: TEAM,
            ...STATIONS[2],
            by: UserId.of('user_bob'),
            at: ago(21 * DAY),
          }),
        )
        .asked(InboxAsk.of(STATIONS[2].stationId, ago(9 * DAY)))
        .asked(InboxAsk.of(STATIONS[2].stationId, ago(2 * DAY)))
        .asked(InboxAsk.of(STATIONS[2].stationId, ago(12 * HOUR)))
        .recordAction(
          TaskHumanAction.of({
            kind: 'started',
            by: UserId.of('user_bob'),
            stationId: STATIONS[2].stationId,
            at: ago(20 * DAY),
          }),
        )
        .recordAction(
          TaskHumanAction.of({
            kind: 'refused',
            by: UserId.of('user_bob'),
            stationId: STATIONS[2].stationId,
            at: ago(DAY),
          }),
        ),
    );

    await chats.add(
      ChatRecord.start({
        chatId: 'chat_gus',
        workspaceId: WORKSPACE,
        teamId: TEAM,
        startedBy: UserId.of(GUS),
        startedAt: ago(9 * DAY),
      }),
    );

    for (let index = 0; index < PULL_REQUESTS; index += 1) {
      const home = prPick(HOMES);
      const repository = prPick(PR_REPOSITORIES);
      const openedAt = ago(Math.floor(prRandom() * 120 * DAY));
      const later = (hours: number) =>
        new Date(openedAt.getTime() + hours * HOUR);
      const state = prPick(['open', 'merged', 'merged', 'closed'] as const);
      const owner =
        prRandom() < 0.5 ? `task_${Math.floor(prRandom() * (RUNS / 2))}` : null;
      let record = PullRequestRecord.noted(
        home.workspaceId,
        PullRequestUrl.of(`https://github.com/${repository}/pull/${index}`),
      ).seenAs({
        repository,
        number: index,
        title: prPick(PR_TITLES),
        author: prPick(['ada', 'dependabot', 'bob']),
        authorIsBot: prRandom() < 0.2,
        branch: prPick([null, 'feat/uploads', 'fix/login', 'chore/deps']),
        additions: Math.floor(prRandom() * 400),
        deletions: Math.floor(prRandom() * 100),
        changedFiles: 1 + Math.floor(prRandom() * 9),
        openedAt,
        state,
        closedAt: state === 'open' ? null : later(1 + prRandom() * 90),
        updatedAt: later(100),
        readyForReviewAt: prRandom() < 0.9 ? later(0.5) : null,
        draftPeriods:
          prRandom() < 0.2 ? [{ from: later(1), to: later(2) }] : [],
        firstReviewAt: prRandom() < 0.6 ? later(3) : null,
        firstUnblockingReviewAt: prRandom() < 0.5 ? later(4) : null,
        firstApprovedAt: prRandom() < 0.4 ? later(5) : null,
        humanReviewedAt: prRandom() < 0.5 ? [later(3), later(6)] : [],
        reviews: Math.floor(prRandom() * 4),
        reviewRounds: Math.floor(prRandom() * 4),
        reviewComments: Math.floor(prRandom() * 9),
        botActivity:
          prRandom() < 0.3
            ? [
                {
                  login: 'coderabbit',
                  reviews: 1,
                  comments: Math.floor(prRandom() * 5),
                  threads: 2,
                  resolvedThreads: Math.floor(prRandom() * 3),
                },
              ]
            : [],
        isRevert: prRandom() < 0.05,
        revertedBy:
          prRandom() < 0.15 ? 'https://github.com/acme/api/pull/999' : null,
        version: 1,
      });

      if (owner) {
        record = record.assignOwner({
          taskId: TaskId.of(owner),
          teamId: prRandom() < 0.8 ? home.teamId : NEXT_DOOR,
        });
      }
      if (prRandom() < 0.2) {
        record = record.recordReview(TaskId.of(`task_review_${index}`));
      }

      await pullRequests.add(record);

      if (owner && prRandom() < 0.5 && !shaped.has(owner)) {
        shaped.add(owner);
        await shapes.add(
          TaskChangeShape.create({
            taskId: TaskId.of(owner),
            workspaceId: home.workspaceId,
            teamId: home.teamId,
            shape: {
              changeTitles: [prPick(PR_TITLES), prPick(PR_TITLES)],
              changeIntents: ['', prPick(PR_TITLES)],
              at: later(2),
            },
          }),
        );
      }
    }

    const stalePull = PullRequestUrl.of(
      'https://github.com/acme/api/pull/stale',
    );

    await records.add(
      RunRecord.empty(RunId.of('run_stale'), WORKSPACE).recordEnd(
        RunEnd.of({
          location: RunLocation.of({
            teamId: TEAM,
            ...STATIONS[0],
            taskId: TaskId.of('task_stale'),
          }),
          fingerprint: 'a'.repeat(64),
          agentConfig: RunAgentConfig.of({
            harness: 'claude-code',
            model: 'sonnet',
            effort: null,
            profileKey: null,
            repositories: ['acme/api'],
            skills: [],
          }),
          queuedAt: null,
          startedAt: ago(300 * DAY + HOUR),
          endedAt: ago(300 * DAY),
          ending: 'completed',
          failure: null,
          visit: 1,
          asked: false,
        }),
      ),
    );
    await taskPullRequests.add(
      TaskPullRequest.open({
        taskId: TaskId.of('task_stale'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest: stalePull,
        at: ago(300 * DAY),
      }).recordReview({ pullRequest: stalePull, byBot: false, at: ago(DAY) }),
    );
    await taskPullRequests.add(
      TaskPullRequest.open({
        taskId: TaskId.of('task_left_open'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest: PullRequestUrl.of(
          'https://github.com/acme/api/pull/left-open',
        ),
        at: ago(300 * DAY),
      }),
    );
  });
}, 120_000);

afterAll(async () => {
  await database?.close();
});

describe('the insights reader against the team history', () => {
  it.each(INSIGHTS_PERIODS)(
    'counts the same runs as the domain over %s',
    async (name) => {
      const { history, period } = await historyOver(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.stationCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });
      const expected = teamCountsOf(
        {
          ...history,
          taskHumanActions: await historyRepositoriesOf(
            referenceRepositories(),
          ).taskHumanActions.forTasks(
            history.failures.map((each) => each.taskId),
          ),
        },
        period,
      );
      expect(counts).toEqual(expected);
      expect(teamReportFrom(counts, period)).toEqual(
        teamReportFrom(expected, period),
      );
      expect(stationReportsFrom(counts, period)).toEqual(
        stationReportsFrom(expected, period),
      );
    },
  );

  it('covers what makes a station report hard to get right', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const stations = stationReportsFrom(
      await reader.stationCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      }),
      period,
    );

    expect(stations.map((each) => each.stationId)).toContain('deleted_station');
    expect(stations.map((each) => each.stationId)).not.toContain(
      'elsewhere_only',
    );
    expect(stations.some((each) => each.tally.mixedCurrencies)).toBe(true);
    expect(stations.some((each) => each.tally.merged > 0)).toBe(true);
    expect(stations.some((each) => each.tally.cancelled > 0)).toBe(true);
    expect(stations.some((each) => each.taskFailures.length > 1)).toBe(true);
    expect(stations.some((each) => each.runFailures.length > 1)).toBe(true);
  });
  it.each(INSIGHTS_PERIODS)(
    'counts the same overview as the domain over %s',
    async (name) => {
      const over = await historyOver(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const { history, period } = over;
      const counts = await reader.overviewCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });
      const expected = overviewCountsOf(
        history,
        period,
        await carriedOver(over),
        openingsOf(
          await historyRepositoriesOf(
            referenceRepositories(),
          ).taskHumanActions.forTasks([
            ...history.failures.map((each) => each.taskId),
            ...history.taskPullRequests.map((each) => each.taskId),
          ]),
        ),
      );
      expect(counts).toEqual(expected);
    },
  );

  it('covers what makes an overview hard to get right', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const counts = await reader.overviewCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const merged = counts.resolved.filter((each) => each.merged);

    expect(counts.markers.length).toBeGreaterThan(1);
    expect(merged.some((each) => each.taskOpenedAt !== null)).toBe(true);
    expect(counts.resolved.some((each) => !each.merged)).toBe(true);
    expect(counts.current.people).toContain(FAR);
    expect(counts.current.humanActions).toBeGreaterThan(0);
    expect(counts.previous.runs).toBeGreaterThan(0);
    expect(counts.spending.size).toBeGreaterThan(10);
    expect(counts.failingBefore.length).toBeGreaterThan(0);
  });
  it.each(INSIGHTS_PERIODS)(
    'counts the same cost as the domain over %s',
    async (name) => {
      const { history, period } = await historyOver(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.costCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });
      expect({ ...counts, current: ordered(counts.current) }).toEqual({
        current: ordered(costCountsOf(history, period.current)),
        spendBefore: costCountsOf(history, period.previous).spend,
      });
    },
  );

  it('breaks the cost of a period priced in one currency down', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '30d',
    );
    const { current } = await reader.costCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const breakdown = costBreakdownFrom(current);

    expect(current.spend?.currency).toBe('USD');
    expect(breakdown.nodes.length).toBeGreaterThan(3);
    expect(breakdown.links.length).toBeGreaterThan(3);
    expect(breakdown.byRepository.length).toBeGreaterThan(1);
  });

  it('covers what makes a cost breakdown hard to get right', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const { current } = await reader.costCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const repositories = current.shares.filter(
      (each) => each.part === 'repository',
    );

    expect(repositories.map((each) => each.key).sort()).toEqual([
      'acme/api',
      'acme/docs',
      'acme/run_euro',
      'acme/run_tie_a',
      'acme/run_tie_b',
      'acme/web',
      null,
    ]);
    expect(current.links.some((each) => each.target.key === null)).toBe(true);
    expect(current.cache?.cacheWrite).not.toBeNull();
    expect(current.cacheByStation.some((each) => each.cache === null)).toBe(
      true,
    );
    expect(current.mixedCurrencies).toBe(true);
    expect(current.spend).toBeNull();

    const tiedAt = (model: string) =>
      current.shares.find((each) => each.part === 'model' && each.key === model)
        ?.first.run ?? Number.NaN;

    expect(tiedAt('gpt')).toBe(tiedAt('haiku') + 1);
    expect(current.shares.some((each) => each.key === null)).toBe(true);
  });

  it.each(INSIGHTS_PERIODS)(
    'counts the same flow as the domain over %s',
    async (name) => {
      const { history, period } = await historyOver(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.flowCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });
      const expected = flowCountsOf(
        history,
        period,
        openingsOf(
          await historyRepositoriesOf(
            referenceRepositories(),
          ).taskHumanActions.forTasks(
            history.taskPullRequests.map((each) => each.taskId),
          ),
        ),
      );
      const byStation = <T extends { readonly stationId: string }>(
        items: readonly T[],
      ) => [...items].sort((a, b) => a.stationId.localeCompare(b.stationId));
      expect({
        ...counts,
        current: { ...counts.current, inbox: byStation(counts.current.inbox) },
        previous: {
          ...counts.previous,
          inbox: byStation(counts.previous.inbox),
        },
      }).toEqual({
        ...expected,
        current: {
          ...expected.current,
          inbox: byStation(expected.current.inbox),
        },
        previous: {
          ...expected.previous,
          inbox: byStation(expected.previous.inbox),
        },
      });
    },
  );

  it('covers what makes a flow hard to get right', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const { current, deliveries } = await reader.flowCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });

    expect(current.stations.some((each) => each.queued.count > 0)).toBe(true);
    expect(current.stations.some((each) => each.running.count > 1)).toBe(true);
    expect(current.inbox.some((each) => each.unanswered > 0)).toBe(true);
    expect(current.inbox.some((each) => each.inbox.count > 0)).toBe(true);
    expect(deliveries.some((each) => each.firstReviewAt !== null)).toBe(true);
    expect(
      deliveries.some((each) => each.closedAt === null && !each.merged),
    ).toBe(true);
    expect(deliveries.some((each) => each.taskOpenedAt !== null)).toBe(true);
    expect(deliveries.map((each) => each.taskId)).toContain('task_stale');
    expect(deliveries.map((each) => each.taskId)).not.toContain(
      'task_left_open',
    );
  });

  it.each(INSIGHTS_PERIODS)(
    'counts the same people as the domain over %s',
    async (name) => {
      const { history, period } = await historyOver(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.peopleCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });
      expect(counts).toEqual(peopleCountsOf(history, period));
    },
  );

  it('covers what makes people counts hard to get right', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const { load, adoption } = await reader.peopleCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });

    expect(load.current.refused).toBeGreaterThan(1);
    expect(load.current.refusedTaskIds.length).toBeGreaterThan(1);
    expect(load.current.askedTaskIds.length).toBeGreaterThan(1);
    expect(load.current.unanswered).toBeGreaterThan(0);
    expect(load.current.sentBack).toBeGreaterThan(0);
    expect(adoption.people.map((each) => each.personId)).toContain(FAR);
    expect(adoption.people.some((each) => each.chats > 0)).toBe(true);
    expect(adoption.people.some((each) => each.opened > 0)).toBe(true);
  });

  it('counts someone active only the period before in it and in the month, not now', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );
    const { load, adoption } = await reader.peopleCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const askedBefore = new Set(load.previous.askedTaskIds);
    const bob = adoption.people.find((each) => each.personId === 'user_bob');

    expect(load.current.askedTaskIds).toContain('task_both_windows');
    expect(askedBefore.has('task_both_windows')).toBe(true);
    expect(adoption.people.map((each) => each.personId)).not.toContain(GUS);
    expect(adoption.monthly).toBeGreaterThan(adoption.weekly);
    expect(adoption.before).toBeGreaterThan(0);
    expect(bob?.firstAt.getTime()).toBeLessThan(period.current.from.getTime());
  });
});

describe('the Shipping numbers of a team', () => {
  const REPOSITORIES = ['Acme/API', 'acme/web'];
  const expectedOf = async (name: string) => {
    const { history, period } = await historyOver(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      name,
    );
    const team = { workspaceId: WORKSPACE, teamId: TEAM, period };
    const stored = await pullRequestsStoredIn(
      runs,
      pullRequestRepositoriesOf(referenceRepositories()),
      team,
      { repositories: REPOSITORIES, from: period.previous.from, max: 10_000 },
    );

    return {
      team,
      expected: shippingCountsOf(
        stored,
        pipelineCountsOf(history, shippedTaskIdsOf(stored, period), period),
        period,
      ),
    };
  };

  it.each(INSIGHTS_PERIODS)(
    'counts the same Shipping numbers as the domain over %s',
    async (name) => {
      const { team, expected } = await expectedOf(name);

      expect(await reader.shippingCounts(team, REPOSITORIES)).toEqual(expected);
    },
  );

  it('covers what makes the Shipping numbers hard to get right', async () => {
    const { team } = await expectedOf('90d');
    const counts = await reader.shippingCounts(team, REPOSITORIES);
    const [awaitingReview] = counts.pipeline.review;

    expect(counts.toMerge.spotlight.count).toBeGreaterThan(1);
    expect(counts.toMerge.people.count).toBeGreaterThan(1);
    expect(counts.toMergeBefore.spotlight.count).toBeGreaterThan(0);
    expect(counts.types.length).toBeGreaterThan(2);
    expect(counts.depth.some((each) => each.merged > 0)).toBe(true);
    expect(
      counts.mergeDays.some(
        (each) => each.rolling.spotlight.count > each.daily.spotlight.count,
      ),
    ).toBe(true);
    expect(
      counts.reviewDays.some((each) => each.toFirstReview.rolling.count > 1),
    ).toBe(true);
    expect(counts.reviewDays.some((each) => each.awaiting > 0)).toBe(true);
    expect(counts.reviewDays.some((each) => each.humanReviews > 0)).toBe(true);
    expect(counts.bots.length).toBeGreaterThan(0);
    expect(counts.pipeline.merged).toBeGreaterThan(1);
    expect(counts.pipeline.merged).toBeLessThan(counts.toMerge.spotlight.count);
    expect(counts.pipeline.stations.length).toBeGreaterThan(1);
    expect(awaitingReview?.times.all.total.count).toBeGreaterThan(0);
  });
});

describe('how the Shipping numbers treat a day’s edges, drafts, bots and the period before', () => {
  const SHIP = TeamId.of('team_ship_edges');
  const period = InsightsPeriod.of('7d', NOW);
  const team = { workspaceId: WORKSPACE, teamId: SHIP, period };
  const REPOSITORIES = ['acme/edges', 'acme/before'];
  const dayAt = (days: number, hours = 0) =>
    new Date(period.current.from.getTime() + days * DAY + hours * HOUR);
  const bot = (login: string): BotActivity => ({
    login,
    reviews: 1,
    comments: 2,
    threads: 1,
    resolvedThreads: 1,
  });

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const added = new DrizzlePullRequestRecordRepository(context);
    const seenAt = (
      repository: string,
      number: number,
      over: Partial<
        Pick<
          SeenPullRequest,
          | 'openedAt'
          | 'state'
          | 'closedAt'
          | 'readyForReviewAt'
          | 'draftPeriods'
          | 'firstUnblockingReviewAt'
          | 'humanReviewedAt'
          | 'botActivity'
        >
      >,
    ) =>
      PullRequestRecord.noted(
        WORKSPACE,
        PullRequestUrl.of(`https://github.com/${repository}/pull/${number}`),
      ).seenAs({
        repository,
        number,
        title: 'Add uploads',
        author: 'ada',
        authorIsBot: false,
        branch: null,
        additions: 1,
        deletions: 1,
        changedFiles: 1,
        openedAt: dayAt(-5),
        state: 'open',
        closedAt: null,
        updatedAt: dayAt(-5),
        readyForReviewAt: null,
        draftPeriods: [],
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
        ...over,
      });
    const owned = (number: number) => ({
      taskId: TaskId.of(`task_ship_${number}`),
      teamId: SHIP,
    });

    await context.inTransaction(async () => {
      await added.add(
        seenAt('acme/edges', 1, {
          openedAt: dayAt(2, -5),
          state: 'merged',
          closedAt: dayAt(2),
        }).assignOwner(owned(1)),
      );
      await added.add(
        seenAt('acme/edges', 2, {
          readyForReviewAt: dayAt(4),
          humanReviewedAt: [dayAt(5)],
        }),
      );
      await added.add(
        seenAt('acme/edges', 3, {
          state: 'merged',
          closedAt: dayAt(3, 12),
          readyForReviewAt: dayAt(3),
          draftPeriods: [{ from: dayAt(3, -3), to: dayAt(3, -2) }],
          firstUnblockingReviewAt: dayAt(3, 2),
        }),
      );
      await added.add(
        seenAt('acme/edges', 4, {
          openedAt: dayAt(1),
          botActivity: [bot('alpha')],
        }),
      );
      await added.add(
        seenAt('acme/edges', 5, {
          openedAt: dayAt(2, 1),
          botActivity: [bot('zeta')],
        }),
      );
      await added.add(
        seenAt('acme/before', 6, {
          state: 'merged',
          closedAt: dayAt(-3),
        }).assignOwner(owned(6)),
      );
      await added.add(
        seenAt('acme/before', 7, { state: 'merged', closedAt: dayAt(-2) }),
      );
    });
  });

  it('counts a merge, a ready pull request and a human review at midnight in the day that starts then, takes off only the draft time inside the wait, keeps bots in the order it first saw them, and compares the period before in its own repositories', async () => {
    const counts = await reader.shippingCounts(team, REPOSITORIES);
    const { history } = await historyOver(
      SHIP.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );
    const stored = await pullRequestsStoredIn(
      runs,
      pullRequestRepositoriesOf(referenceRepositories()),
      team,
      { repositories: REPOSITORIES, from: period.previous.from, max: 100 },
    );
    const mergeDay = (at: number) =>
      counts.mergeDays.find((each) => each.day === dayOf(dayAt(at)));
    const reviewDay = (at: number) =>
      counts.reviewDays.find((each) => each.day === dayOf(dayAt(at)));

    expect(mergeDay(1)?.daily.spotlight.count).toBe(0);
    expect(mergeDay(2)?.daily.spotlight.count).toBe(1);
    expect([reviewDay(2)?.awaiting, reviewDay(3)?.awaiting]).toEqual([1, 1]);
    expect([reviewDay(4)?.humanReviews, reviewDay(5)?.humanReviews]).toEqual([
      0, 1,
    ]);
    expect(reviewDay(3)?.toFirstReview.daily).toMatchObject({
      p50: 2 * HOUR,
      count: 1,
    });
    expect(counts.bots.map((each) => each.login)).toEqual(['zeta', 'alpha']);
    expect(counts.toMergeBefore.people.count).toBe(1);
    expect(counts).toEqual(
      shippingCountsOf(
        stored,
        pipelineCountsOf(history, shippedTaskIdsOf(stored, period), period),
        period,
      ),
    );
  });
});

describe('how Shipping clips review and pipeline times at their edges', () => {
  const WAITS = TeamId.of('team_ship_waits');
  const CLIPS = TeamId.of('team_ship_clips');
  const period = InsightsPeriod.of('7d', NOW);
  const dayAt = (days: number, hours = 0) =>
    new Date(period.current.from.getTime() + days * DAY + hours * HOUR);
  const bot = (login: string): BotActivity => ({
    login,
    reviews: 1,
    comments: 2,
    threads: 1,
    resolvedThreads: 1,
  });
  const shippingOf = async (
    teamId: TeamId,
    repositories: readonly string[],
  ) => {
    const team = { workspaceId: WORKSPACE, teamId, period };
    const { history } = await historyOver(
      teamId.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );
    const stored = await pullRequestsStoredIn(
      runs,
      pullRequestRepositoriesOf(referenceRepositories()),
      team,
      { repositories, from: period.previous.from, max: 100 },
    );

    return {
      counts: await reader.shippingCounts(team, repositories),
      expected: shippingCountsOf(
        stored,
        pipelineCountsOf(history, shippedTaskIdsOf(stored, period), period),
        period,
      ),
    };
  };

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const facts = new DrizzleRunFactProjection(context);
    const added = new DrizzlePullRequestRecordRepository(context);
    const humanActions = new DrizzleTaskHumanActionsRepository(context, facts);
    const seenAt = (
      repository: string,
      number: number,
      over: Partial<SeenPullRequest>,
    ) =>
      PullRequestRecord.noted(
        WORKSPACE,
        PullRequestUrl.of(`https://github.com/${repository}/pull/${number}`),
      ).seenAs({
        repository,
        number,
        title: 'Add uploads',
        author: 'ada',
        authorIsBot: false,
        branch: null,
        additions: 1,
        deletions: 1,
        changedFiles: 1,
        openedAt: dayAt(-1),
        state: 'open',
        closedAt: null,
        updatedAt: dayAt(-1),
        readyForReviewAt: dayAt(1),
        draftPeriods: [],
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
        ...over,
      });

    await context.inTransaction(async () => {
      for (const [number, over] of [
        [1, { draftPeriods: [{ from: dayAt(1, 2), to: dayAt(3) }] }],
        [2, { draftPeriods: [{ from: dayAt(3), to: dayAt(4) }] }],
        [3, { draftPeriods: [{ from: dayAt(2, 5), to: null }] }],
        [4, { state: 'merged', closedAt: dayAt(3) }],
        [5, { firstUnblockingReviewAt: dayAt(3) }],
        [
          6,
          {
            draftPeriods: [{ from: dayAt(1, 1), to: null }],
            firstUnblockingReviewAt: dayAt(1, 3),
          },
        ],
        [
          7,
          {
            draftPeriods: [{ from: dayAt(1, 1), to: dayAt(1, 5) }],
            firstUnblockingReviewAt: dayAt(1, 3),
          },
        ],
        [
          8,
          {
            readyForReviewAt: dayAt(2),
            draftPeriods: [
              { from: dayAt(2), to: dayAt(2, 2) },
              { from: dayAt(2), to: dayAt(2, 2) },
            ],
            firstUnblockingReviewAt: dayAt(2, 2),
          },
        ],
        [
          9,
          { readyForReviewAt: null, botActivity: [bot('zeta'), bot('alpha')] },
        ],
        [
          10,
          {
            readyForReviewAt: null,
            state: 'closed',
            closedAt: period.current.from,
            botActivity: [bot('beta')],
          },
        ],
      ] as const) {
        await added.add(seenAt('acme/waits', number, over));
      }

      const opening = (taskId: string, at: Date) =>
        humanActions.add(
          TaskHumanActions.empty(TaskId.of(taskId), WORKSPACE).recordOpen(
            TaskOpening.of({
              teamId: CLIPS,
              lineId: 'line_clips',
              stationId: 'draft',
              by: VIEWER,
              at,
            }),
          ),
        );

      for (const [number, openedAt, over] of [
        [
          1,
          dayAt(2),
          { title: 'Fix the login', openedAt: dayAt(1), closedAt: dayAt(3) },
        ],
        [
          2,
          dayAt(0),
          {
            openedAt: dayAt(1),
            closedAt: dayAt(2),
            firstUnblockingReviewAt: dayAt(2, 3),
          },
        ],
        [
          3,
          dayAt(0),
          {
            openedAt: dayAt(1),
            closedAt: dayAt(2),
            firstUnblockingReviewAt: dayAt(1),
            firstApprovedAt: dayAt(3),
          },
        ],
        [4, period.lookback.from, { openedAt: dayAt(1), closedAt: dayAt(3) }],
      ] as const) {
        const taskId = `task_clips_${number}`;

        await opening(taskId, openedAt);
        await added.add(
          seenAt('acme/clips', number, {
            ...over,
            state: 'merged',
            readyForReviewAt: null,
          }).assignOwner({ taskId: TaskId.of(taskId), teamId: CLIPS }),
        );
      }
    });
  });

  it('waits for a review only outside a draft and before the review or the close, and takes off only the draft time inside the wait', async () => {
    const { counts, expected } = await shippingOf(WAITS, ['acme/waits']);
    const reviewDay = (at: number) =>
      counts.reviewDays.find((each) => each.day === dayOf(dayAt(at)));

    expect(reviewDay(2)?.awaiting).toBe(1);
    expect(reviewDay(1)?.toFirstReview.daily).toMatchObject({
      p50: 1 * HOUR,
      count: 2,
    });
    expect(reviewDay(2)?.toFirstReview.daily).toMatchObject({
      p50: 0,
      count: 1,
    });
    expect(counts.bots.map((each) => each.login)).toEqual([
      'zeta',
      'alpha',
      'beta',
    ]);
    expect(counts).toEqual(expected);
  });

  it('counts a stage of the pipeline as nothing when it would end before it starts, ends review at the earlier of approval and merge, and takes a task opened as the look back starts', async () => {
    const { counts, expected } = await shippingOf(CLIPS, []);
    const [, inReview] = counts.pipeline.review;

    expect(counts.pipeline.merged).toBe(4);
    expect(counts.pipeline.coding.times.all.total).toMatchObject({
      p50: 1 * DAY,
      count: 4,
    });
    expect(
      counts.pipeline.coding.times.types.find((each) => each.type === 'fix')
        ?.times.total,
    ).toMatchObject({ p50: 0, count: 1 });
    expect(inReview?.times.all.total).toMatchObject({ count: 2 });
    expect(inReview?.times.all.total.p90).toBe(1 * DAY);
    expect(counts).toEqual(expected);
  });
});

describe('the runs a team ran, a page at a time', () => {
  it.each([
    ['nothing', {}],
    ['a station', { stationId: STATIONS[0].stationId }],
    ['a line', { lineId: STATIONS[2].lineId }],
    ['an outcome', { outcome: 'failed' }],
    ['a harness', { harness: 'codex' }],
    ['a model', { model: 'opus' }],
    ['the harness’s own model', { model: HARNESS_DEFAULT_MODEL }],
    ['a repository', { repository: 'acme/api' }],
    ['no repository', { repository: NO_REPOSITORY }],
    ['a station config', { fingerprint: 'a'.repeat(64) }],
    ['some tasks', { taskIds: ['task_0', 'task_1', 'task_2', 'task_3'] }],
    ['no task', { taskIds: [] }],
    ['the person who opened the task', { personId: PEOPLE[0] }],
    ['a day', { day: dayOf(ago(3 * DAY)) }],
    ['a week', { week: weekOf(ago(10 * DAY)) }],
    ['a skill enabled', { skillEnabled: 'grafana' }],
    ['a skill used', { skillUsed: 'grafana' }],
    ['a server', { server: 'linear' }],
    ['a server that failed', { serverFailed: 'github' }],
    ['a server it failed after', { failedAfter: 'sentry' }],
    ['a refused tool', { refusedTool: 'merge' }],
    ['a refused tool of no server', { refusedServer: NO_SERVER }],
    ['a pull request state', { pullRequestState: 'merged' }],
    ['a human action', { humanAction: TASK_ACTIONS[0] }],
    ['a task that asked', { asked: 'true' }],
    [
      'a station and a person',
      { stationId: STATIONS[1].stationId, personId: PEOPLE[1] },
    ],
  ] as const)(
    'lists the same runs as the records when it requests %s',
    async (_, over) => {
      const { access, period } = await scopes.scope(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        '30d',
      );
      const filter = runFilterOf({ ...NO_RUN_FILTER, ...over }, period.current);
      const size = 25;
      const listingOf = (page: number) => ({
        window: windowOf(access, period.current),
        filter,
        offset: (page - 1) * size,
        limit: size,
      });
      const first = await reader.runPage(listingOf(1));

      for (let page = 1; page <= Math.ceil(first.total / size) + 1; page++) {
        expect(await reader.runPage(listingOf(page))).toEqual(
          await runsListedIn(
            historyRepositoriesOf(referenceRepositories()),
            listingOf(page),
          ),
        );
      }
    },
  );

  it('covers what makes listing runs hard to get right', async () => {
    const { access, period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const { runs: listed } = await reader.runPage({
      window: windowOf(access, period.current),
      filter: runFilterOf(NO_RUN_FILTER, period.current),
      offset: 0,
      limit: 10_000,
    });

    expect(listed.some((each) => each.openedBy !== null)).toBe(true);
    expect(listed.some((each) => each.pullRequestState !== null)).toBe(true);
    expect(listed.some((each) => each.firstHumanAction !== null)).toBe(true);
    expect(listed.some((each) => each.passed !== null)).toBe(true);
    expect(listed.some((each) => each.cost !== null)).toBe(true);
    expect(listed.some((each) => each.ending === 'superseded')).toBe(true);
    expect(listed.some((each) => each.tokens === null)).toBe(true);
    expect(listed.some((each) => each.queuedMs !== null)).toBe(true);
    expect(
      listed.some(
        (each, at) =>
          at > 0 &&
          each.endedAt.getTime() === listed[at - 1]?.endedAt.getTime(),
      ),
    ).toBe(true);
  });
});

describe('how the run list treats the window’s edges and runs that ended together', () => {
  const EDGES = TeamId.of('team_run_edges');
  const period = InsightsPeriod.of('7d', NOW);
  const { from, to } = period.current;
  const dayAt = (days: number, hours = 0) =>
    new Date(from.getTime() + days * DAY + hours * HOUR);
  const listingOf = (over: Partial<RunFilterQuery>) => ({
    window: { workspaceId: WORKSPACE, teamId: EDGES, from, to },
    filter: runFilterOf({ ...NO_RUN_FILTER, ...over }, period.current),
    offset: 0,
    limit: 20,
  });
  const listed = async (over: Partial<RunFilterQuery>) => {
    const listing = listingOf(over);
    const read = await reader.runPage(listing);

    expect(read).toEqual(
      await runsListedIn(
        historyRepositoriesOf(referenceRepositories()),
        listing,
      ),
    );

    return read.runs.map((each) => each.runId);
  };

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const facts = new DrizzleRunFactProjection(context);
    const records = new DrizzleRunRecordRepository(context, facts, quiet);
    const humanActions = new DrizzleTaskHumanActionsRepository(context, facts);

    await context.inTransaction(async () => {
      for (const [runId, endedAt, started] of [
        ['run_edge_from', from, true],
        ['run_edge_to', to, true],
        ['run_B', dayAt(1), true],
        ['run_a', dayAt(1), true],
        ['run_day_start', dayAt(2), true],
        ['run_next_day', dayAt(3), true],
        ['run_queued_only', dayAt(4, 1), false],
        ['run_ask_from', dayAt(5), true],
        ['run_ask_to', dayAt(5), true],
        ['run_ask_elsewhere', dayAt(6), true],
      ] as const) {
        await records.add(
          RunRecord.empty(RunId.of(runId), WORKSPACE).recordEnd(
            RunEnd.of({
              location: RunLocation.of({
                teamId: EDGES,
                lineId: 'line_edges',
                stationId: 'edges',
                taskId: TaskId.of(`task_${runId}`),
              }),
              fingerprint: 'a'.repeat(64),
              agentConfig: RunAgentConfig.of({
                harness: 'claude-code',
                model: 'sonnet',
                effort: null,
                profileKey: null,
                repositories: [],
                skills: [],
              }),
              queuedAt: new Date(endedAt.getTime() - 3 * HOUR),
              startedAt: started ? new Date(endedAt.getTime() - HOUR) : null,
              endedAt,
              ending: started ? 'completed' : 'cancelled',
              failure: null,
              visit: 1,
              asked: false,
            }),
          ),
        );
      }

      for (const [runId, workspaceId, askedAt] of [
        ['run_ask_from', WORKSPACE, from],
        ['run_ask_to', WORKSPACE, to],
        ['run_ask_elsewhere', WorkspaceId.of('workspace_elsewhere'), dayAt(1)],
      ] as const) {
        await humanActions.add(
          TaskHumanActions.empty(TaskId.of(`task_${runId}`), workspaceId).asked(
            InboxAsk.of('edges', askedAt),
          ),
        );
      }
    });
  });

  it('keeps a run that ended as the window starts, leaves out one that ended as it ends, and lists runs that ended together by their ids', async () => {
    expect(await listed({})).toEqual([
      'run_ask_elsewhere',
      'run_ask_to',
      'run_ask_from',
      'run_queued_only',
      'run_next_day',
      'run_day_start',
      'run_a',
      'run_B',
      'run_edge_from',
    ]);
  });

  it('times only the queue of a run that started, and nothing of one that never did', async () => {
    const { runs: read } = await reader.runPage(listingOf({}));

    expect(read.find((each) => each.runId === 'run_a')).toMatchObject({
      queuedMs: 2 * HOUR,
      runningMs: HOUR,
    });
    expect(read.find((each) => each.runId === 'run_queued_only')).toMatchObject(
      { queuedMs: null, runningMs: null },
    );
  });

  it('takes into a day the run that ended as it starts, not the one that ended as it ends, and into the period an ask as it starts, not one as it ends nor one of another workspace', async () => {
    expect(await listed({ day: dayOf(dayAt(2)) })).toEqual(['run_day_start']);
    expect(await listed({ asked: 'true' })).toEqual(['run_ask_from']);
  });
});

describe('the tools a team’s runs used', () => {
  it.each(INSIGHTS_PERIODS)(
    'counts the same tools as the domain over %s',
    async (name) => {
      const { history, period } = await historyOver(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.toolCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });
      expect(counts).toEqual(toolCountsOf(history, period.current));
    },
  );

  it('covers what makes tool counts hard to get right', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const { skills, servers, refusals } = await reader.toolCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const timed = (latency: readonly number[]) =>
      latency.reduce((sum, each) => sum + each, 0);

    expect(skills.some((each) => each.enabled === 0 && each.used > 0)).toBe(
      true,
    );
    expect(skills.some((each) => each.enabled > 0 && each.used === 0)).toBe(
      true,
    );
    expect(servers.length).toBe(3);
    expect(servers.some((each) => timed(each.latency) < each.calls)).toBe(true);
    expect(servers.every((each) => each.failingRuns > 0)).toBe(true);
    expect(servers.some((each) => each.refused > 0)).toBe(true);
    expect(refusals.some((each) => each.server === null)).toBe(true);
  });
});

describe('how the tool counts fall into weeks and leave out what did not run', () => {
  const TOOLS = TeamId.of('team_tools');
  const period = InsightsPeriod.of('7d', NOW);
  const monday = weekWindowOf(weekOf(NOW)).from;
  const before = weekOf(new Date(monday.getTime() - 1));
  const served = (
    server: string,
    calls: number,
    timed: readonly number[],
  ): ServerCalls => ({
    server,
    calls,
    failed: calls - timed.length,
    latency: LatencyHistogram.timing(timed),
    lastCallFailed: calls > timed.length,
  });

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const records = new DrizzleRunRecordRepository(
      context,
      new DrizzleRunFactProjection(context),
      quiet,
    );
    const ended = (
      runId: string,
      stationId: string,
      endedAt: Date,
      ending: RunEnding,
      skills: readonly string[],
      tools: RunTools,
    ) =>
      RunRecord.empty(RunId.of(runId), WORKSPACE)
        .recordEnd(
          RunEnd.of({
            location: RunLocation.of({
              teamId: TOOLS,
              lineId: 'line_tools',
              stationId,
              taskId: TaskId.of(`task_${runId}`),
            }),
            fingerprint: 'a'.repeat(64),
            agentConfig: RunAgentConfig.of({
              harness: 'claude-code',
              model: 'sonnet',
              effort: null,
              profileKey: null,
              repositories: [],
              skills: [...skills],
            }),
            queuedAt: null,
            startedAt: new Date(endedAt.getTime() - HOUR),
            endedAt,
            ending,
            failure: null,
            visit: 1,
            asked: false,
          }),
        )
        .recordUsage(
          RunUsage.of({
            ms: 1_000,
            steps: 1,
            errors: 0,
            changedLines: 1,
            contextTokens: null,
            contextWindow: null,
            amount: null,
            currency: null,
            tokens: { input: 1, output: 1, cacheRead: null, cacheWrite: null },
          }),
          tools,
        );

    await context.inTransaction(async () => {
      await records.add(
        ended(
          'tools_monday',
          'tool_a',
          monday,
          'failed',
          ['grafana'],
          RunTools.of({
            servers: [served('linear', 2, [100]), served('sentry', 1, [50])],
            skillsRead: ['grafana'],
          }),
        ),
      );
      await records.add(
        ended(
          'tools_sunday',
          'tool_b',
          new Date(monday.getTime() - 1),
          'failed',
          [],
          RunTools.of({
            servers: [served('linear', 1, [])],
            skillsRead: ['Search'],
          }),
        )
          .supersededByItsTask(monday)
          .refused(
            Refusal.of({
              tool: 'merge',
              server: 'linear',
              at: new Date(monday.getTime() - HOUR),
            }),
          )
          .refused(
            Refusal.of({
              tool: 'merge',
              server: 'linear',
              at: new Date(monday.getTime() - 2 * HOUR),
            }),
          )
          .refused(
            Refusal.of({
              tool: 'merge',
              server: null,
              at: new Date(monday.getTime() - HOUR),
            }),
          )
          .refused(
            Refusal.of({
              tool: 'search',
              server: 'sentry',
              at: new Date(monday.getTime() - HOUR),
            }),
          ),
      );
      await records.add(
        ended(
          'tools_cancelled',
          'tool_c',
          monday,
          'cancelled',
          ['grafana'],
          RunTools.of({
            servers: [served('linear', 1, [50])],
            skillsRead: ['grafana'],
          }),
        ).refused(Refusal.of({ tool: 'merge', server: 'linear', at: monday })),
      );
    });
  });

  it('puts a run that ends at midnight on Monday in the new week, counts a failing call only on a run that still failed, and counts a refusal at a server the run did not call', async () => {
    const counts = await reader.toolCounts({
      workspaceId: WORKSPACE,
      teamId: TOOLS,
      period,
    });
    const { history } = await historyOver(
      TOOLS.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );
    const week = weekOf(monday);
    const bucketOf100 = LatencyHistogram.timing([100]).counts;

    expect(counts).toEqual({
      runs: [
        { stationId: null, week: null, runs: 2 },
        { stationId: null, week: before, runs: 1 },
        { stationId: null, week, runs: 1 },
        { stationId: 'tool_a', week: null, runs: 1 },
        { stationId: 'tool_a', week, runs: 1 },
        { stationId: 'tool_b', week: null, runs: 1 },
        { stationId: 'tool_b', week: before, runs: 1 },
      ],
      stations: [
        { lineId: 'line_tools', stationId: 'tool_b' },
        { lineId: 'line_tools', stationId: 'tool_a' },
      ],
      skills: [
        { key: 'Search', stationId: null, week: null, enabled: 0, used: 1 },
        { key: 'Search', stationId: null, week: before, enabled: 0, used: 1 },
        { key: 'Search', stationId: 'tool_b', week: null, enabled: 0, used: 1 },
        {
          key: 'Search',
          stationId: 'tool_b',
          week: before,
          enabled: 0,
          used: 1,
        },
        { key: 'grafana', stationId: null, week: null, enabled: 1, used: 1 },
        { key: 'grafana', stationId: null, week, enabled: 1, used: 1 },
        {
          key: 'grafana',
          stationId: 'tool_a',
          week: null,
          enabled: 1,
          used: 1,
        },
        { key: 'grafana', stationId: 'tool_a', week, enabled: 1, used: 1 },
      ],
      servers: [
        {
          server: 'linear',
          runs: 2,
          calls: 3,
          failedCalls: 2,
          latency: bucketOf100,
          failingRuns: 1,
          refused: 1,
        },
        {
          server: 'sentry',
          runs: 1,
          calls: 1,
          failedCalls: 0,
          latency: LatencyHistogram.timing([50]).counts,
          failingRuns: 0,
          refused: 1,
        },
      ],
      refusals: [
        { tool: 'merge', server: null, refused: 1 },
        { tool: 'merge', server: 'linear', refused: 1 },
        { tool: 'search', server: 'sentry', refused: 1 },
      ],
    });
    expect(counts).toEqual(toolCountsOf(history, period.current));
  });
});

describe('the memories a team’s runs used', () => {
  it.each(INSIGHTS_PERIODS)(
    'counts the same memory use as the domain over %s',
    async (name) => {
      const { history, period } = await historyOver(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.memoryCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });
      expect(counts).toEqual(memoryCountsOf(history, period.current));
    },
  );

  it('covers what makes memory use hard to get right', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const counts = await reader.memoryCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const groups = [counts.withMemories, counts.withoutMemories];

    expect(groups.every((each) => each.tally.runs > 10)).toBe(true);
    expect(
      groups.some(
        (each) => each.measured.finished > each.measured.finishedTasks,
      ),
    ).toBe(true);
    expect(groups.every((each) => each.measured.acted > 0)).toBe(true);
    expect(
      groups.every((each) => each.measured.usageRecorded < each.tally.runs),
    ).toBe(true);
    expect(counts.runsBriefed).toBeLessThan(counts.withMemories.tally.runs);
    expect(counts.runsRecalled).toBeLessThan(counts.withMemories.tally.runs);
    expect(counts.memoriesBriefed).toBe(4);
  });
});

describe('how the memory counts leave out what did not run', () => {
  const REMEMBERING = TeamId.of('team_remembering');
  const period = InsightsPeriod.of('7d', NOW);

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const facts = new DrizzleRunFactProjection(context);
    const records = new DrizzleRunRecordRepository(context, facts, quiet);
    const taskPullRequests = new DrizzleTaskPullRequestRepository(
      context,
      facts,
      quiet,
    );
    const ended = (runId: string, ending: RunEnding, hoursAgo: number) =>
      RunRecord.empty(RunId.of(runId), WORKSPACE).recordEnd(
        RunEnd.of({
          location: RunLocation.of({
            teamId: REMEMBERING,
            lineId: 'line_remembering',
            stationId: 'remember',
            taskId: TaskId.of(`task_${runId}`),
          }),
          fingerprint: 'a'.repeat(64),
          agentConfig: RunAgentConfig.of({
            harness: 'claude-code',
            model: 'sonnet',
            effort: null,
            profileKey: null,
            repositories: [],
            skills: [],
          }),
          queuedAt: null,
          startedAt: ago(hoursAgo * HOUR + HOUR),
          endedAt: ago(hoursAgo * HOUR),
          ending,
          failure: null,
          visit: 1,
          asked: false,
        }),
      );
    const withPullRequest = (runId: string, state: 'merged' | 'open') => {
      const pullRequest = PullRequestUrl.of(
        `https://github.com/acme/remember/pull/${runId.length}${state.length}`,
      );
      const opened = TaskPullRequest.open({
        taskId: TaskId.of(`task_${runId}`),
        workspaceId: WORKSPACE,
        teamId: REMEMBERING,
        pullRequest,
        at: ago(3 * HOUR),
      });

      return state === 'open'
        ? opened
        : opened.close({ pullRequest, merged: true, at: ago(HOUR) });
    };

    await context.inTransaction(async () => {
      await records.add(
        ended('remembered', 'completed', 2)
          .recordAction(HumanAction.of('accepted', ago(HOUR)))
          .recordMemories('briefed', ['mem_one']),
      );
      await records.add(
        ended('cancelled_remembering', 'cancelled', 2).recordMemories(
          'briefed',
          ['mem_cancelled'],
        ),
      );
      await records.add(
        ended('recalling', 'failed', 3).recordMemories('recalled', ['mem_one']),
      );
      await records.add(ended('without_memories', 'completed', 4));
      await records.add(
        ended('long_ago', 'completed', 24 * 30).recordMemories('briefed', [
          'mem_old',
        ]),
      );
      await taskPullRequests.add(withPullRequest('remembered', 'merged'));
      await taskPullRequests.add(withPullRequest('without_memories', 'open'));
    });
  });

  it('counts the memories of a cancelled run but not the run, and counts merges only on finished pull requests', async () => {
    const counts = await reader.memoryCounts({
      workspaceId: WORKSPACE,
      teamId: REMEMBERING,
      period,
    });
    const { history } = await historyOver(
      REMEMBERING.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );

    expect(counts).toMatchObject({
      runsBriefed: 1,
      runsRecalled: 1,
      memoriesBriefed: 2,
      memoriesRecalled: 1,
      withMemories: {
        tally: { runs: 2, cancelled: 0, failed: 1, accepted: 1, merged: 1 },
        measured: { acted: 1, finished: 1, finishedTasks: 1, usageRecorded: 0 },
      },
      withoutMemories: {
        tally: { runs: 1, merged: 0 },
        measured: { acted: 0, finished: 0, finishedTasks: 0, usageRecorded: 0 },
      },
    });
    expect(counts).toEqual(memoryCountsOf(history, period.current));
  });
});

const agentConfigsExpected = async (
  history: TeamHistory,
  period: InsightsPeriod,
  stationId: string | null,
  size: RunSize | null,
) => {
  const records = agentConfigRunsWithin(
    history.records,
    period.current,
    stationId,
    size,
  );

  return agentConfigCountsOf(
    records,
    history.taskPullRequests,
    stationId === null
      ? []
      : judgedRunsOf(
          await scores.ofRuns(records.map((each) => each.runId)),
          stationId,
        ),
  );
};

describe('the agent configs a team’s runs used', () => {
  const FILTERS = [null, 'review', 'plan', 'elsewhere_only'].flatMap(
    (stationId) => [null, ...RUN_SIZES].map((size) => ({ stationId, size })),
  );

  it.each(INSIGHTS_PERIODS)(
    'counts the same agent configs as the domain over %s, for every station and size',
    async (name) => {
      const { history, period } = await historyOver(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );

      for (const { stationId, size } of FILTERS) {
        expect(
          await reader.agentConfigCounts(
            { workspaceId: WORKSPACE, teamId: TEAM, period },
            { stationId, size },
          ),
        ).toEqual(await agentConfigsExpected(history, period, stationId, size));
      }
    },
  );

  it('covers what makes agent config counts hard to get right', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const at = (stationId: string | null, size: RunSize | null) =>
      reader.agentConfigCounts(
        { workspaceId: WORKSPACE, teamId: TEAM, period },
        { stationId, size },
      );
    const all = await at(null, null);
    const review = await at('review', null);

    expect(all.agentConfigs.length).toBeGreaterThan(3);
    expect(all.agentConfigs.some((each) => each.model === null)).toBe(true);
    expect(all.agentConfigs.some((each) => each.effort === null)).toBe(true);
    expect(all.agentConfigs.some((each) => each.profileKey !== null)).toBe(
      true,
    );
    expect(all.agentConfigs.every((each) => each.rubrics.length === 0)).toBe(
      true,
    );
    expect(
      all.agentConfigs.some(
        (each) => each.answered > each.counts.measured.acted,
      ),
    ).toBe(true);
    expect(review.agentConfigs.some((each) => each.rubrics.length === 2)).toBe(
      true,
    );
    for (const size of RUN_SIZES) {
      expect((await at(null, size)).agentConfigs.length).toBeGreaterThan(0);
    }
  });
});

describe('the config changes of a team', () => {
  it.each(INSIGHTS_PERIODS)(
    'counts the same changes as the domain over %s',
    async (name) => {
      const over = await historyOver(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const { history, period } = over;
      expect(
        await reader.changeCounts({
          workspaceId: WORKSPACE,
          teamId: TEAM,
          period,
        }),
      ).toEqual(
        changeCountsOf(
          history,
          period,
          await carriedOver(over),
          await scores.ofRuns(history.records.map((each) => each.runId)),
        ),
      );
    },
  );

  it('covers what makes config changes hard to get right', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '30d',
    );
    const changes = await reader.changeCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const sides = changes.flatMap((each) => [each.before, each.after]);

    expect(changes.length).toBeGreaterThan(5);
    expect(new Set(changes.map((each) => each.marker.stationId)).size).toBe(
      STATIONS.length,
    );
    expect(sides.some((each) => each.tally.cancelled > 0)).toBe(true);
    expect(
      changes.some(
        (each) => each.judgedBefore.length > 0 && each.judgedAfter.length > 0,
      ),
    ).toBe(true);
  });
});

describe('how a config change splits a station’s runs', () => {
  const CHANGING = TeamId.of('team_changing');
  const period = InsightsPeriod.of('7d', NOW);
  const A = 'a'.repeat(64);
  const B = 'b'.repeat(64);
  const RUBRIC = 'd'.repeat(64);

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const records = new DrizzleRunRecordRepository(
      context,
      new DrizzleRunFactProjection(context),
      quiet,
    );
    const judged = new DrizzleScoreRepository(context, quiet);
    const ran = (
      runId: string,
      stationId: string,
      fingerprint: string,
      beganHoursAgo: number,
      ending: RunEnding = 'completed',
      endedHoursAgo = beganHoursAgo - 0.5,
    ) =>
      records.add(
        RunRecord.empty(RunId.of(runId), WORKSPACE).recordEnd(
          RunEnd.of({
            location: RunLocation.of({
              teamId: CHANGING,
              lineId: 'line_changing',
              stationId,
              taskId: TaskId.of(`task_${runId}`),
            }),
            fingerprint,
            agentConfig: RunAgentConfig.of({
              harness: 'claude-code',
              model: 'sonnet',
              effort: null,
              profileKey: null,
              repositories: [],
              skills: [],
            }),
            queuedAt: null,
            startedAt:
              ending === 'cancelled' ? null : ago(beganHoursAgo * HOUR),
            endedAt: ago(endedHoursAgo * HOUR),
            ending,
            failure: null,
            visit: 1,
            asked: false,
          }),
        ),
      );
    const judgedAt = (runId: string, stationId: string, met: number) => {
      const claimResults = Array.from({ length: 10 }, (_, at) => at < met);

      return judged.add(
        Score.judge({
          id: ScoreId.of(`score_${runId}`),
          runId: RunId.of(runId),
          workspaceId: WORKSPACE,
          location: RunLocation.of({
            teamId: CHANGING,
            lineId: 'line_changing',
            stationId,
            taskId: TaskId.of(`task_${runId}`),
          }),
          fingerprint: B,
          scale: ScoreScale.claims(),
          value: metRate(claimResults),
          claimResults,
          rubricVersion: RUBRIC,
          model: 'judge/model',
          reasons: claimResults.map((_, at) =>
            JudgeReason.of({
              text: `Reason ${at}.`,
              citations: [Citation.ofStep(1)],
              claim: at,
            }),
          ),
          seen: SeenEvidence.none(),
          at: ago(HOUR),
        }),
      );
    };

    await context.inTransaction(async () => {
      await ran('flip_a1', 'flip', A, 100);
      await ran('flip_b_early', 'flip', B, 90, 'cancelled');
      await ran('flip_b1', 'flip', B, 80);
      await ran('flip_a_early', 'flip', A, 70, 'cancelled');
      await ran('flip_a2', 'flip', A, 60);
      await ran('carry_old', 'carry', A, 24 * 60);
      await ran('carry_new', 'carry', B, 50);
      await ran('tie_first', 'tie', A, 40);
      await ran('tie_b', 'tie', B, 30);
      await ran('tie_a', 'tie', A, 30);
      await ran('judged_old', 'judged', A, 20);

      for (const [runId, met] of [
        ['judged_c', 3],
        ['judged_b', 2],
        ['judged_a', 1],
      ] as const) {
        await ran(runId, 'judged', B, 10);
        await judgedAt(runId, 'judged', met);
      }

      await ran('ord_old', 'ordered', A, 9);

      for (const [runId, began, ended, met] of [
        ['ord_1', 6, 1, 1],
        ['ord_2', 5, 2, 2],
        ['ord_3', 4, 3, 3],
      ] as const) {
        await ran(runId, 'ordered', B, began, 'completed', ended);
        await judgedAt(runId, 'ordered', met);
      }

      await ran('tie2_a', 'tie2', A, 26);
      await ran('tie2_b', 'tie2', B, 26);
      await ran('tie2_c', 'tie2', B, 22);
    });
  });

  it('splits at each change, counts a cancelled run of the new config before it as after, leaves a side empty, breaks ties by run, and sums judge rates in end order', async () => {
    const changes = await reader.changeCounts({
      workspaceId: WORKSPACE,
      teamId: CHANGING,
      period,
    });
    const inPeriod = await historyOver(
      CHANGING.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );
    const sides = (runId: string) => {
      const change = changes.find((each) => each.marker.runId === runId);

      return change
        ? [
            change.before.tally.runs,
            change.before.tally.cancelled,
            change.after.tally.runs,
            change.after.tally.cancelled,
          ]
        : null;
    };

    expect(
      changes.map((each) => [
        each.marker.stationId,
        each.marker.runId,
        each.marker.previousFingerprint === A ? 'A' : 'B',
      ]),
    ).toEqual([
      ['flip', 'flip_b1', 'A'],
      ['flip', 'flip_a2', 'B'],
      ['carry', 'carry_new', 'A'],
      ['tie', 'tie_b', 'A'],
      ['tie2', 'tie2_b', 'A'],
      ['judged', 'judged_a', 'A'],
      ['ordered', 'ord_1', 'A'],
    ]);
    expect(sides('flip_b1')).toEqual([1, 0, 1, 1]);
    expect(sides('flip_a2')).toEqual([1, 0, 1, 1]);
    expect(sides('carry_new')).toEqual([0, 0, 1, 0]);
    expect(sides('tie_b')).toEqual([2, 0, 1, 0]);
    expect(
      changes.find((each) => each.marker.runId === 'judged_a')?.judgedAfter,
    ).toEqual([
      {
        rubricVersion: RUBRIC,
        // Keep this order: 0.1 + 0.2 + 0.3 is not equal to 0.6.
        sum: 0.1 + 0.2 + 0.3,
        judged: 3,
      },
    ]);
    expect(
      changes.find((each) => each.marker.runId === 'ord_1')?.judgedAfter,
    ).toEqual([
      {
        rubricVersion: RUBRIC,
        // Keep this order: the runs ended in this order.
        sum: 0.3 + 0.2 + 0.1,
        judged: 3,
      },
    ]);
    expect(changes).toEqual(
      changeCountsOf(
        inPeriod.history,
        period,
        await carriedOver(inPeriod),
        await scores.ofRuns(inPeriod.history.records.map((each) => each.runId)),
      ),
    );
  });
});

describe('how agent configs fall into sizes and judges', () => {
  const SIZED = TeamId.of('team_sized');
  const period = InsightsPeriod.of('7d', NOW);
  const SIZES: readonly (readonly [string, number, number, boolean])[] = [
    ['lines_50', 50, 99, true],
    ['lines_51', 51, 1, true],
    ['lines_401', 401, 1, true],
    ['steps_20', 0, 20, true],
    ['steps_21', 0, 21, true],
    ['not_digested', 0, 1, false],
  ];

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const records = new DrizzleRunRecordRepository(
      context,
      new DrizzleRunFactProjection(context),
      quiet,
    );
    const judged = new DrizzleScoreRepository(context, quiet);
    const locationOf = (runId: string) =>
      RunLocation.of({
        teamId: SIZED,
        lineId: 'line_sized',
        stationId: 'sizing',
        taskId: TaskId.of(`task_${runId}`),
      });

    await context.inTransaction(async () => {
      for (const [runId, changedLines, steps, digested] of [
        ...SIZES,
      ].reverse()) {
        const ended = RunRecord.empty(RunId.of(runId), WORKSPACE).recordEnd(
          RunEnd.of({
            location: locationOf(runId),
            fingerprint: 'a'.repeat(64),
            agentConfig: RunAgentConfig.of({
              harness: 'claude-code',
              model: 'sonnet',
              effort: null,
              profileKey: null,
              repositories: [],
              skills: [],
            }),
            queuedAt: null,
            startedAt: ago(2 * HOUR),
            endedAt: ago(HOUR),
            ending: 'completed',
            failure: null,
            visit: 1,
            asked: false,
          }),
        );

        await records.add(
          digested
            ? ended.recordUsage(
                RunUsage.of({
                  ms: 1_000,
                  steps,
                  errors: 0,
                  changedLines,
                  contextTokens: null,
                  contextWindow: null,
                  amount: 1,
                  currency: 'USD',
                  tokens: {
                    input: null,
                    output: null,
                    cacheRead: null,
                    cacheWrite: null,
                  },
                }),
                RunTools.NONE,
              )
            : ended,
        );
      }

      const oneIn = (met: number, of: number) =>
        Array.from({ length: of }, (_, at) => at < met);

      for (const [runId, claimResults] of [
        ['steps_20', oneIn(3, 10)],
        ['lines_51', oneIn(1, 5)],
        ['lines_50', oneIn(1, 10)],
      ] as const) {
        await judged.add(
          Score.judge({
            id: ScoreId.of(`score_${runId}`),
            runId: RunId.of(runId),
            workspaceId: WORKSPACE,
            location: locationOf(runId),
            fingerprint: null,
            scale: ScoreScale.claims(),
            value: metRate(claimResults),
            claimResults,
            rubricVersion: 'c'.repeat(64),
            model: 'judge/model',
            reasons: claimResults.map((_, at) =>
              JudgeReason.of({
                text: `Reason ${at}.`,
                citations: [Citation.ofStep(1)],
                claim: at,
              }),
            ),
            seen: SeenEvidence.none(),
            at: ago(HOUR),
          }),
        );
      }
    });
  });

  it('puts a run at each limit in the right size, leaves a run with no recorded usage out of every size, and sums each judge rate', async () => {
    const { history } = await historyOver(
      SIZED.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );
    const runsOf = async (size: RunSize | null) =>
      (
        await reader.agentConfigCounts(
          { workspaceId: WORKSPACE, teamId: SIZED, period },
          { stationId: 'sizing', size },
        )
      ).agentConfigs[0]?.counts.tally.runs ?? 0;
    const all = await reader.agentConfigCounts(
      { workspaceId: WORKSPACE, teamId: SIZED, period },
      { stationId: 'sizing', size: null },
    );

    expect(await runsOf('small')).toBe(2);
    expect(await runsOf('medium')).toBe(2);
    expect(await runsOf('large')).toBe(1);
    expect(await runsOf(null)).toBe(6);
    expect(all.agentConfigs[0]?.rubrics).toEqual([
      {
        rubricVersion: 'c'.repeat(64),
        // Keep this order: 0.1 + 0.2 + 0.3 is not equal to 0.6.
        sum: 0.1 + 0.2 + 0.3,
        judged: 3,
      },
    ]);
    expect(all).toEqual(
      await agentConfigsExpected(history, period, 'sizing', null),
    );
  });
});

describe('the pull requests a team made or reviewed', () => {
  it('covers what makes reading pull requests hard to get right', async () => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const { pullRequests: read } = await reader.pullRequestPage(
      { workspaceId: WORKSPACE, teamId: TEAM, period },
      {
        repositories: ['Acme/API', 'acme/web'],
        filter: {
          repositories: null,
          author: null,
          type: null,
          state: null,
          week: null,
          reverted: false,
          rounds: null,
          compared: false,
        },
        page: 1,
        size: 10_000,
      },
    );

    expect(new Set(read.map((each) => each.by)).size).toBe(4);
    expect(new Set(read.map((each) => each.type)).size).toBeGreaterThan(4);
    expect(read.some((each) => each.spending.mixedCurrencies)).toBe(true);
    expect(read.some((each) => each.spending.unpriced > 0)).toBe(true);
    expect(read.some((each) => each.spending.spend !== null)).toBe(true);
    expect(
      read.some(
        (each) => each.by === 'spotlight' && !each.pullRequest.includes('acme'),
      ),
    ).toBe(true);
    expect(read.some((each) => each.seen.state === 'open')).toBe(true);
  });
});

describe('the pull request numbers and list of a team', () => {
  const REPOSITORIES = ['Acme/API', 'acme/web'];
  const pullRequestsFor = (team: TeamInPeriod) =>
    pullRequestsStoredIn(
      runs,
      pullRequestRepositoriesOf(referenceRepositories()),
      team,
      {
        repositories: REPOSITORIES,
        from: team.period.current.from,
        max: 10_000,
      },
    );
  const teamOver = async (name: string): Promise<TeamInPeriod> => {
    const { period } = await scopes.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      name,
    );

    return { workspaceId: WORKSPACE, teamId: TEAM, period };
  };
  const filterOf = (over: Partial<PullRequestFilter>): PullRequestFilter => ({
    repositories: null,
    author: null,
    type: null,
    state: null,
    week: null,
    reverted: false,
    rounds: null,
    compared: false,
    ...over,
  });

  it.each(INSIGHTS_PERIODS)(
    'counts the same pull requests as the domain over %s',
    async (name) => {
      const team = await teamOver(name);

      expect(await reader.pullRequestCounts(team, REPOSITORIES)).toEqual(
        pullRequestCountsOf(await pullRequestsFor(team), team.period.current),
      );
    },
  );

  it('covers what makes the pull request numbers hard to get right', async () => {
    const team = await teamOver('90d');
    const counts = await reader.pullRequestCounts(team, REPOSITORIES);
    const insights = pullRequestInsightsFrom(
      counts,
      REPOSITORIES,
      team.period.current,
    );

    expect(new Set(counts.tallies.map((each) => each.by)).size).toBe(4);
    expect(counts.compared.length).toBeGreaterThan(0);
    expect(counts.people.merged).toBeGreaterThan(0);
    expect(counts.spotlight.reverted).toBeGreaterThan(0);
    expect(counts.spotlight.inReview.count).toBeGreaterThan(1);
    expect(counts.types.some((each) => each.spend !== null)).toBe(true);
    expect(counts.types.some((each) => each.mixedCurrencies)).toBe(true);
    expect(counts.types.some((each) => each.unpriced > 0)).toBe(true);
    expect(
      counts.depth.every((each) => each.spotlight > 0 && each.people > 0),
    ).toBe(true);
    expect(
      insights.spotlightShare.repositories.map((each) => each.repository),
    ).toContain('other/tool');
  });

  it.each([
    ['nothing', {}],
    ['open', { state: 'open' }],
    ['merged', { state: 'merged' }],
    ['closed', { state: 'closed' }],
    ['made by Spotlight', { author: 'spotlight' }],
    ['reviewed by Spotlight', { author: 'reviewed' }],
    ['made by people', { author: 'people' }],
    ['made by bots', { author: 'bots' }],
    ['a fix', { type: 'fix' }],
    ['a feature', { type: 'feature' }],
    ['reverted', { reverted: true }],
    ['no review round', { rounds: '0' }],
    ['three review rounds or more', { rounds: '3+' }],
    ['in a compared repository', { compared: true }],
    [
      'in a repository written in other letters',
      { repositories: ['ACME/api'] },
    ],
    ['in no repository', { repositories: [] }],
    [
      'merged by people in a compared repository',
      { compared: true, author: 'people', state: 'merged' },
    ],
  ] as const)(
    'lists the same pages as the domain when it requests %s',
    async (_, over) => {
      const team = await teamOver('30d');
      const filter = filterOf(over);
      const listed = filteredPullRequests(
        await pullRequestsFor(team),
        filter,
        team.period.current,
      );
      const size = 7;

      for (let page = 1; page <= Math.ceil(listed.length / size) + 1; page++) {
        expect(
          await reader.pullRequestPage(team, {
            repositories: REPOSITORIES,
            filter,
            page,
            size,
          }),
        ).toEqual({
          total: listed.length,
          pullRequests: listed.slice((page - 1) * size, page * size),
        });
      }
    },
  );

  it('lists the same page as the domain for a week', async () => {
    const team = await teamOver('30d');
    const filter = filterOf({ week: weekWindowOf(weekOf(ago(10 * DAY))) });
    const listed = filteredPullRequests(
      await pullRequestsFor(team),
      filter,
      team.period.current,
    );

    expect(listed.length).toBeGreaterThan(0);
    expect(
      await reader.pullRequestPage(team, {
        repositories: REPOSITORIES,
        filter,
        page: 1,
        size: 100,
      }),
    ).toEqual({ total: listed.length, pullRequests: listed });
  });
});

describe('how pull requests fall into the window and what their task spent', () => {
  const PULLS = TeamId.of('team_pulls');
  const period = InsightsPeriod.of('7d', NOW);
  const from = period.current.from;
  const pullOf = (number: number) =>
    PullRequestUrl.of(`https://github.com/acme/pulls/pull/${number}`);

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const records = new DrizzleRunRecordRepository(
      context,
      new DrizzleRunFactProjection(context),
      quiet,
    );
    const added = new DrizzlePullRequestRecordRepository(context);
    const seenAt = (number: number, openedAt: Date, closedAt: Date | null) =>
      PullRequestRecord.noted(WORKSPACE, pullOf(number)).seenAs({
        repository: 'acme/pulls',
        number,
        title: 'Add uploads',
        author: 'ada',
        authorIsBot: false,
        branch: null,
        additions: 1,
        deletions: 1,
        changedFiles: 1,
        openedAt,
        state: closedAt ? 'merged' : 'open',
        closedAt,
        updatedAt: openedAt,
        readyForReviewAt: openedAt,
        draftPeriods: [],
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
      });

    await context.inTransaction(async () => {
      await added.add(
        seenAt(1, new Date(from.getTime() - 5 * DAY), from).assignOwner({
          taskId: TaskId.of('task_pulls_spent'),
          teamId: PULLS,
        }),
      );
      await added.add(
        seenAt(
          2,
          new Date(from.getTime() - 5 * DAY),
          new Date(from.getTime() - 1),
        ).assignOwner({
          taskId: TaskId.of('task_pulls_before'),
          teamId: PULLS,
        }),
      );
      await added.add(
        seenAt(3, period.current.to, null).assignOwner({
          taskId: TaskId.of('task_pulls_after'),
          teamId: PULLS,
        }),
      );

      for (const [number, openedAt] of [
        [4, new Date(from.getTime() + HOUR)],
        [5, new Date(from.getTime() + HOUR)],
      ] as const) {
        await added.add(
          seenAt(number, openedAt, null).assignOwner({
            taskId: TaskId.of(`task_pulls_${number}`),
            teamId: PULLS,
          }),
        );
      }

      for (const [runId, amount, endedHoursAgo] of [
        ['pulls_a', 0.3, 1],
        ['pulls_b', 0.2, 2],
        ['pulls_c', 0.1, 3],
      ] as const) {
        await records.add(
          RunRecord.empty(RunId.of(runId), WORKSPACE)
            .recordEnd(
              RunEnd.of({
                location: RunLocation.of({
                  teamId: PULLS,
                  lineId: 'line_pulls',
                  stationId: 'pulls',
                  taskId: TaskId.of('task_pulls_spent'),
                }),
                fingerprint: 'a'.repeat(64),
                agentConfig: RunAgentConfig.of({
                  harness: 'claude-code',
                  model: 'sonnet',
                  effort: null,
                  profileKey: null,
                  repositories: [],
                  skills: [],
                }),
                queuedAt: null,
                startedAt: ago((endedHoursAgo + 1) * HOUR),
                endedAt: ago(endedHoursAgo * HOUR),
                ending: 'completed',
                failure: null,
                visit: 1,
                asked: false,
              }),
            )
            .recordUsage(
              RunUsage.of({
                ms: 1_000,
                steps: 1,
                errors: 0,
                changedLines: 1,
                contextTokens: null,
                contextWindow: null,
                amount,
                currency: 'USD',
                tokens: {
                  input: null,
                  output: null,
                  cacheRead: null,
                  cacheWrite: null,
                },
              }),
              RunTools.NONE,
            ),
        );
      }
    });
  });

  it('keeps one closed at the window start and leaves out one closed before it or opened at its end, breaks a tie by pull request, and sums its task’s spend in end order', async () => {
    const team = { workspaceId: WORKSPACE, teamId: PULLS, period };
    const filter = {
      repositories: null,
      author: null,
      type: null,
      state: null,
      week: null,
      reverted: false,
      rounds: null,
      compared: false,
    };
    const { pullRequests: read } = await reader.pullRequestPage(team, {
      repositories: [],
      filter,
      page: 1,
      size: 100,
    });

    expect(read.map((each) => each.pullRequest)).toEqual([
      pullOf(4).value,
      pullOf(5).value,
      pullOf(1).value,
    ]);
    expect(read[2]?.spending).toEqual({
      // Keep this order: 0.1 + 0.2 + 0.3 is not equal to 0.6.
      spend: { amount: 0.1 + 0.2 + 0.3, currency: 'USD' },
      priced: 3,
      unpriced: 0,
      mixedCurrencies: false,
    });
    expect(read).toEqual(
      filteredPullRequests(
        await pullRequestsStoredIn(
          runs,
          pullRequestRepositoriesOf(referenceRepositories()),
          team,
          { repositories: [], from, max: 100 },
        ),
        filter,
        period.current,
      ),
    );
  });
});

describe('how the pull request numbers round, sum and sort', () => {
  const MATHS = TeamId.of('team_pull_maths');
  const period = InsightsPeriod.of('7d', NOW);
  const from = period.current.from;
  const closed = new Date(from.getTime() + 2 * DAY);
  const hoursIn = (hours: number) => new Date(from.getTime() + hours * HOUR);
  const pullOf = (repository: string, number: number) =>
    PullRequestUrl.of(`https://github.com/${repository}/pull/${number}`);
  const REPOSITORIES = [
    'acme/maths',
    'acme/lone',
    'acme/open',
    'acme/reviewed',
  ];
  const team = { workspaceId: WORKSPACE, teamId: MATHS, period };
  const peopleListed = async (compared: boolean, page = 1) =>
    reader.pullRequestPage(team, {
      repositories: REPOSITORIES,
      filter: {
        repositories: null,
        author: 'people',
        type: null,
        state: null,
        week: null,
        reverted: false,
        rounds: null,
        compared,
      },
      page,
      size: 10,
    });

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const records = new DrizzleRunRecordRepository(
      context,
      new DrizzleRunFactProjection(context),
      quiet,
    );
    const added = new DrizzlePullRequestRecordRepository(context);
    const seenAt = (
      repository: string,
      number: number,
      over: {
        readonly spelled?: string;
        readonly title?: string;
        readonly openedAt?: Date;
        readonly closedAt?: Date | null;
        readonly firstReviewAt?: Date | null;
        readonly authorIsBot?: boolean;
      } = {},
    ) => {
      const openedAt = over.openedAt ?? hoursIn(1);
      const closedAt = over.closedAt === undefined ? closed : over.closedAt;

      return PullRequestRecord.noted(
        WORKSPACE,
        pullOf(over.spelled ?? repository, number),
      ).seenAs({
        repository,
        number,
        title: over.title ?? 'Update the readme',
        author: 'ada',
        authorIsBot: over.authorIsBot ?? false,
        branch: null,
        additions: 1,
        deletions: 1,
        changedFiles: 1,
        openedAt,
        state: closedAt ? 'merged' : 'open',
        closedAt,
        updatedAt: closedAt ?? openedAt,
        readyForReviewAt: openedAt,
        draftPeriods: [],
        firstReviewAt: over.firstReviewAt ?? null,
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
      });
    };
    const owned = (number: number) => ({
      taskId: TaskId.of(`task_maths_${number}`),
      teamId: MATHS,
    });
    const spent = (
      runId: string,
      taskId: TaskId,
      amount: number,
      currency: string,
    ) =>
      records.add(
        RunRecord.empty(RunId.of(runId), WORKSPACE)
          .recordEnd(
            RunEnd.of({
              location: RunLocation.of({
                teamId: MATHS,
                lineId: 'line_maths',
                stationId: 'maths',
                taskId,
              }),
              fingerprint: 'a'.repeat(64),
              agentConfig: RunAgentConfig.of({
                harness: 'claude-code',
                model: 'sonnet',
                effort: null,
                profileKey: null,
                repositories: [],
                skills: [],
              }),
              queuedAt: null,
              startedAt: ago(2 * HOUR),
              endedAt: ago(HOUR),
              ending: 'completed',
              failure: null,
              visit: 1,
              asked: false,
            }),
          )
          .recordUsage(
            RunUsage.of({
              ms: 1_000,
              steps: 1,
              errors: 0,
              changedLines: 1,
              contextTokens: null,
              contextWindow: null,
              amount,
              currency,
              tokens: {
                input: null,
                output: null,
                cacheRead: null,
                cacheWrite: null,
              },
            }),
            RunTools.NONE,
          ),
      );

    await context.inTransaction(async () => {
      for (const [number, hoursAfter, reviewedAfterMs, amount] of [
        [1, 1, 3, 0.1],
        [2, 2, 2, 0.2],
        [3, 3, null, 0.3],
      ] as const) {
        await added.add(
          seenAt('acme/maths', number, {
            title: `Fix part ${number}`,
            openedAt: hoursIn(hoursAfter),
            firstReviewAt:
              reviewedAfterMs === null
                ? null
                : new Date(closed.getTime() + reviewedAfterMs),
          }).assignOwner(owned(number)),
        );
        await spent(`maths_${number}`, owned(number).taskId, amount, 'USD');
      }

      await added.add(
        seenAt('acme/maths', 7, {
          title: 'Write tests for retries',
        }).assignOwner(owned(7)),
      );
      await spent('maths_mixed_usd', owned(7).taskId, 1, 'USD');
      await spent('maths_mixed_eur', owned(7).taskId, 1, 'EUR');

      for (const [repository, number, over] of [
        ['acme/maths', 8, { openedAt: hoursIn(-1), closedAt: from }],
        [
          'acme/maths',
          9,
          { openedAt: hoursIn(-1), closedAt: period.current.to },
        ],
        ['Acme/Tie', 10, { openedAt: hoursIn(5) }],
        ['acme/tie', 11, { openedAt: hoursIn(5) }],
        ['acme/open', 12, { closedAt: null }],
      ] as const) {
        await added.add(
          seenAt(repository, number, {
            ...over,
            title: 'Implement uploads',
          }).assignOwner(owned(number)),
        );
      }

      for (const [repository, number] of [
        ['acme/maths', 5],
        ['acme/lone', 6],
        ['acme/open', 13],
        ['acme/reviewed', 15],
      ] as const) {
        await added.add(seenAt(repository, number));
      }

      await added.add(seenAt('acme/maths', 4, { spelled: 'Acme/maths' }));

      await added.add(
        seenAt('acme/reviewed', 14).recordReview(
          TaskId.of('task_maths_review'),
        ),
      );
      await added.add(
        seenAt('acme/maths', 16, {
          authorIsBot: true,
          closedAt: new Date('2026-10-12T00:00:00.000Z'),
        }),
      );
    });
  });

  it('rounds a median of negative times up, as the domain does, sums the spend of a type newest first, and keeps the window bounds and the first spelling', async () => {
    const counts = await reader.pullRequestCounts(team, REPOSITORIES);
    const typed = (type: string) =>
      counts.types.find((each) => each.type === type);

    expect(counts.compared).toEqual(['acme/tie', 'acme/maths']);
    expect(counts.spotlight.merged).toBe(7);
    expect(counts.people.merged).toBe(2);
    expect(counts.spotlight.inReview).toEqual({ p50: -2, p90: -2, count: 2 });
    expect(typed('fix')?.spend).toEqual({
      // Keep this order: 0.1 + 0.2 + 0.3 is not equal to 0.6.
      amount: 0.3 + 0.2 + 0.1,
      currency: 'USD',
    });
    expect(typed('tests')).toMatchObject({
      spotlight: 1,
      spend: null,
      mixedCurrencies: true,
    });
    expect(typed('feature')?.spotlight).toBe(3);
    expect(counts.tallies).toContainEqual({
      repository: 'acme/maths',
      week: '2026-10-12',
      by: 'bots',
      merged: 1,
    });
    expect(counts).toEqual(
      pullRequestCountsOf(
        await pullRequestsStoredIn(
          runs,
          pullRequestRepositoriesOf(referenceRepositories()),
          team,
          { repositories: REPOSITORIES, from, max: 100 },
        ),
        period.current,
      ),
    );
  });

  it('lists pull requests closed at the same time in the order of their code units, and leaves out repositories without a merged pull request Spotlight made when it requests compared ones', async () => {
    const listed = async (compared: boolean) =>
      (await peopleListed(compared)).pullRequests.map(
        (each) => each.pullRequest,
      );

    expect(await listed(false)).toEqual([
      pullOf('Acme/maths', 4).value,
      pullOf('acme/lone', 6).value,
      pullOf('acme/maths', 5).value,
      pullOf('acme/open', 13).value,
      pullOf('acme/reviewed', 15).value,
    ]);
    expect(await listed(true)).toEqual([
      pullOf('Acme/maths', 4).value,
      pullOf('acme/maths', 5).value,
    ]);
  });

  it('gives an empty page for a page far after the last', async () => {
    expect(await peopleListed(false, 1e300)).toEqual({
      total: 5,
      pullRequests: [],
    });
  });
});

describe('how the inbox pairs answers with asks', () => {
  const WAITS = TeamId.of('team_waits');
  const period = InsightsPeriod.of('7d', NOW);
  const asked = new Date(period.current.from.getTime() + 2 * DAY);
  const askedAgain = new Date(asked.getTime() + DAY);
  const none = { p50: null, p90: null, count: 0 };

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const facts = new DrizzleRunFactProjection(context);
    const records = new DrizzleRunRecordRepository(context, facts, quiet);
    const ended = (
      runId: string,
      place: { readonly lineId: string; readonly stationId: string },
      endedAt: Date,
      ending: RunEnding,
    ) =>
      RunRecord.empty(RunId.of(runId), WORKSPACE).recordEnd(
        RunEnd.of({
          location: RunLocation.of({
            teamId: WAITS,
            ...place,
            taskId: TaskId.of(`task_${runId}`),
          }),
          fingerprint: 'a'.repeat(64),
          agentConfig: RunAgentConfig.of({
            harness: 'claude-code',
            model: 'sonnet',
            effort: null,
            profileKey: null,
            repositories: [],
            skills: [],
          }),
          queuedAt: null,
          startedAt: new Date(endedAt.getTime() - HOUR),
          endedAt,
          ending,
          failure: null,
          visit: 1,
          asked: false,
        }),
      );

    await records.add(
      ended(
        'idle',
        { lineId: 'line_c', stationId: 'idle' },
        asked,
        'cancelled',
      ),
    );
    await records.add(
      ended(
        'waits',
        STATIONS[0],
        new Date(askedAgain.getTime() + HOUR),
        'completed',
      ),
    );
    await new DrizzleTaskHumanActionsRepository(context, facts).add(
      TaskHumanActions.empty(TaskId.of('task_waits'), WORKSPACE)
        .recordOpen(
          TaskOpening.of({
            teamId: WAITS,
            ...STATIONS[0],
            by: VIEWER,
            at: new Date(asked.getTime() - DAY),
          }),
        )
        .asked(InboxAsk.of('review', asked))
        .asked(InboxAsk.of('build', asked))
        .asked(InboxAsk.of('plan', askedAgain))
        .asked(InboxAsk.of('ship', period.current.from))
        .recordAction(
          TaskHumanAction.of({
            kind: 'answered',
            by: VIEWER,
            stationId: 'build',
            at: asked,
          }),
        )
        .recordAction(
          TaskHumanAction.of({
            kind: 'answered',
            by: VIEWER,
            stationId: 'plan',
            at: askedAgain,
          }),
        ),
    );
  });

  it('leaves an ask unanswered when another follows at the same instant, and takes an answer at the very moment of the ask', async () => {
    const counts = await reader.flowCounts({
      workspaceId: WORKSPACE,
      teamId: WAITS,
      period,
    });
    const { history } = await historyOver(
      WAITS.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );

    expect(
      [...counts.current.inbox].sort((a, b) =>
        a.stationId.localeCompare(b.stationId),
      ),
    ).toEqual([
      {
        stationId: 'build',
        asks: 1,
        unanswered: 0,
        inbox: { p50: 0, p90: 0, count: 1 },
      },
      {
        stationId: 'plan',
        asks: 1,
        unanswered: 0,
        inbox: { p50: 0, p90: 0, count: 1 },
      },
      { stationId: 'review', asks: 1, unanswered: 1, inbox: none },
      { stationId: 'ship', asks: 1, unanswered: 1, inbox: none },
    ]);
    expect(counts.current.stations).toEqual([
      {
        lineId: 'line_c',
        stationId: 'idle',
        taskIds: [],
        runs: 0,
        queued: none,
        running: none,
      },
      {
        ...STATIONS[0],
        taskIds: ['task_waits'],
        runs: 1,
        queued: none,
        running: { p50: HOUR, p90: HOUR, count: 1 },
      },
    ]);
    const people = await reader.peopleCounts({
      workspaceId: WORKSPACE,
      teamId: WAITS,
      period,
    });

    expect(people.load.current).toEqual({
      asks: 4,
      unanswered: 2,
      toAnswer: { p50: 0, p90: 0, count: 2 },
      askedTaskIds: ['task_waits'],
      tasks: 1,
      runs: 1,
      sentBack: 0,
      refused: 0,
      refusedTaskIds: [],
    });
    expect(people.adoption).toEqual({
      people: [
        {
          personId: VIEWER.value,
          opened: 1,
          actions: 2,
          chats: 0,
          lastActiveAt: askedAgain,
          firstAt: new Date(asked.getTime() - DAY),
        },
      ],
      before: 0,
      weekly: 1,
      monthly: 1,
    });
    expect(
      flowFrom(counts, period).stations.map((each) => [
        each.stationId,
        each.asks,
      ]),
    ).toEqual([
      ['idle', 0],
      ['plan', 1],
    ]);
    const expected = flowCountsOf(history, period, new Map()).current;

    expect(counts.current.stations).toEqual(expected.stations);
    expect(
      [...counts.current.inbox].sort((a, b) =>
        a.stationId.localeCompare(b.stationId),
      ),
    ).toEqual(
      [...expected.inbox].sort((a, b) =>
        a.stationId.localeCompare(b.stationId),
      ),
    );
  });
});

describe('how the pipeline sums a task’s time at each station', () => {
  const PIPED = TeamId.of('team_piped');
  const period = InsightsPeriod.of('7d', NOW);
  const opened = ago(3 * DAY);
  const at = (hours: number) => new Date(opened.getTime() + hours * HOUR);
  const TASKS = [
    'task_piped',
    'task_long_ago',
    'task_unopened',
    'task_next_door',
    'task_nowhere',
  ];

  beforeAll(async () => {
    const context = new DrizzleContext(database.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const facts = new DrizzleRunFactProjection(context);
    const records = new DrizzleRunRecordRepository(context, facts, quiet);
    const humanActions = new DrizzleTaskHumanActionsRepository(context, facts);
    const added = new DrizzlePullRequestRecordRepository(context);
    const ran = (
      runId: string,
      taskId: string,
      teamId: TeamId,
      stationId: string,
      lineId: string,
      times: {
        readonly queuedAt: Date | null;
        readonly startedAt: Date | null;
        readonly endedAt: Date;
      },
      ending: RunEnding = 'completed',
    ) =>
      records.add(
        RunRecord.empty(RunId.of(runId), WORKSPACE).recordEnd(
          RunEnd.of({
            location: RunLocation.of({
              teamId,
              lineId,
              stationId,
              taskId: TaskId.of(taskId),
            }),
            fingerprint: 'a'.repeat(64),
            agentConfig: RunAgentConfig.of({
              harness: 'claude-code',
              model: 'sonnet',
              effort: null,
              profileKey: null,
              repositories: [],
              skills: [],
            }),
            ...times,
            ending,
            failure: null,
            visit: 1,
            asked: false,
          }),
        ),
      );
    const openedOn = (taskId: string, teamId: TeamId, openedAt: Date) =>
      TaskHumanActions.empty(TaskId.of(taskId), WORKSPACE).recordOpen(
        TaskOpening.of({
          teamId,
          lineId: 'line_piped',
          stationId: 'draft',
          by: VIEWER,
          at: openedAt,
        }),
      );

    await context.inTransaction(async () => {
      await ran('run_piped_b', 'task_piped', PIPED, 'draft', 'line_piped', {
        queuedAt: null,
        startedAt: at(4),
        endedAt: at(5),
      });
      await ran('run_piped_a', 'task_piped', PIPED, 'draft', 'line_piped', {
        queuedAt: at(1),
        startedAt: at(1.5),
        endedAt: at(3),
      });
      await ran(
        'run_piped_c',
        'task_piped',
        PIPED,
        'check',
        'line_piped',
        { queuedAt: at(2), startedAt: null, endedAt: at(3.5) },
        'cancelled',
      );
      await ran('run_piped_d', 'task_piped', PIPED, 'draft', 'line_moved', {
        queuedAt: null,
        startedAt: at(5.5),
        endedAt: at(6),
      });
      await ran('run_long_ago', 'task_long_ago', PIPED, 'late', 'line_piped', {
        queuedAt: null,
        startedAt: at(1),
        endedAt: at(2),
      });
      await ran('run_unopened', 'task_unopened', PIPED, 'late', 'line_piped', {
        queuedAt: null,
        startedAt: at(1),
        endedAt: at(2),
      });
      await ran(
        'run_next_door',
        'task_next_door',
        NEXT_DOOR,
        'late',
        'line_piped',
        {
          queuedAt: null,
          startedAt: at(1),
          endedAt: at(2),
        },
      );
      await humanActions.add(
        openedOn('task_piped', PIPED, opened)
          .asked(InboxAsk.of('draft', at(3)))
          .asked(InboxAsk.of('check', at(5)))
          .asked(InboxAsk.of('draft', at(6)))
          .asked(InboxAsk.of('review', at(8)))
          .recordAction(
            TaskHumanAction.of({
              kind: 'answered',
              by: VIEWER,
              stationId: 'draft',
              at: at(3.5),
            }),
          )
          .recordAction(
            TaskHumanAction.of({
              kind: 'answered',
              by: VIEWER,
              stationId: 'check',
              at: at(5.25),
            }),
          )
          .recordAction(
            TaskHumanAction.of({
              kind: 'answered',
              by: VIEWER,
              stationId: 'review',
              at: at(9),
            }),
          ),
      );
      await humanActions.add(openedOn('task_long_ago', PIPED, ago(60 * DAY)));
      await humanActions.add(
        TaskHumanActions.empty(TaskId.of('task_unopened'), WORKSPACE).asked(
          InboxAsk.of('late', at(2)),
        ),
      );
      await humanActions.add(openedOn('task_next_door', NEXT_DOOR, opened));

      for (const [number, taskId] of TASKS.entries()) {
        const url = PullRequestUrl.of(
          `https://github.com/acme/piped/pull/${number}`,
        );

        await added.add(
          PullRequestRecord.noted(WORKSPACE, url)
            .seenAs({
              repository: 'acme/piped',
              number,
              title: 'Add uploads',
              author: 'ada',
              authorIsBot: false,
              branch: null,
              additions: 1,
              deletions: 1,
              changedFiles: 1,
              openedAt: at(7),
              state: 'merged',
              closedAt: at(10),
              updatedAt: at(10),
              readyForReviewAt: at(7),
              draftPeriods: [{ from: at(7), to: at(8) }],
              firstReviewAt: at(8.5),
              firstUnblockingReviewAt: at(8.5),
              firstApprovedAt: at(9),
              humanReviewedAt: [],
              reviews: 1,
              reviewRounds: 1,
              reviewComments: 0,
              botActivity: [],
              isRevert: false,
              revertedBy: null,
              version: 1,
            })
            .assignOwner({ taskId: TaskId.of(taskId), teamId: PIPED }),
        );
      }
    });
  });

  it('adds up every run and every answered ask of a task opened in the period, and times its review', async () => {
    const team = { workspaceId: WORKSPACE, teamId: PIPED, period };
    const counts = await reader.shippingCounts(team, []);
    const { history } = await historyOver(
      PIPED.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );
    const stored = await pullRequestsStoredIn(
      runs,
      pullRequestRepositoriesOf(referenceRepositories()),
      team,
      { repositories: [], from: period.previous.from, max: 100 },
    );
    const median = (stage: Stage<Timed> | undefined) => ({
      total: stage?.times.all.total.p50,
      queued: stage?.times.all.parts?.queued.p50,
      running: stage?.times.all.parts?.running.p50,
      inbox: stage?.times.all.parts?.inbox.p50,
    });

    expect(counts.pipeline.merged).toBe(1);
    expect(counts.pipeline.stations.map((each) => each.location)).toEqual([
      { lineId: 'line_piped', stationId: 'draft' },
      { lineId: 'line_piped', stationId: 'check' },
    ]);
    expect(counts.pipeline.stations.map(median)).toEqual([
      {
        total: 4 * HOUR,
        queued: 0.5 * HOUR,
        running: 3 * HOUR,
        inbox: 0.5 * HOUR,
      },
      { total: 0.25 * HOUR, queued: 0, running: 0, inbox: 0.25 * HOUR },
    ]);
    expect(
      [counts.pipeline.coding, ...counts.pipeline.review].map(
        (each) => each.times.all.total.p50,
      ),
    ).toEqual([7 * HOUR, 0.5 * HOUR, 0.5 * HOUR, 1 * HOUR]);
    expect(counts).toEqual(
      shippingCountsOf(
        stored,
        pipelineCountsOf(history, shippedTaskIdsOf(stored, period), period),
        period,
      ),
    );
  });
});
