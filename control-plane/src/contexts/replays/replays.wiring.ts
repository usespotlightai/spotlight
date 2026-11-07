import {
  REPLAY_RECHECKS,
  type ReplayRechecksPort,
} from '@change-review/application/ports/replay-rechecks.port';
import {
  RUN_CHANGE_CHECKS,
  type RunChangeChecksPort,
} from '@change-review/application/ports/run-change-checks.port';
import {
  STATION_SOURCE_EDITS,
  type StationSourceEditsPort,
} from '@configuration/application/ports/station-source-edits.port';
import {
  PULL_REQUESTS,
  type PullRequestPort,
} from '@github/application/ports/pull-request.port';
import {
  REPOSITORY_CONTENTS,
  type RepositoryContentsPort,
} from '@github/application/ports/repository-contents.port';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import {
  CHANGE_JUDGMENTS,
  type ChangeJudgmentsPort,
} from '@insights/application/ports/change-judgments.port';
import {
  PAIR_JUDGMENTS,
  type PairJudgmentsPort,
} from '@insights/application/ports/pair-judgments.port';
import {
  RUN_ACCEPTANCE,
  type RunAcceptancePort,
} from '@insights/application/ports/run-acceptance.port';
import { STATION_CONFIG_PULL_REQUESTS } from '@insights/application/ports/station-config-pull-requests.port';
import type { Provider, Type } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { PayloadTypes } from '@platform/events/payload-types';
import { PendingJobWorker } from '@platform/workers/pending-job.worker';
import { ProposeSearchCandidateHandler } from '@replays/application/commands/handlers/propose-search-candidate.handler';
import { RecordFailureCauseHandler } from '@replays/application/commands/handlers/record-failure-cause.handler';
import { StartReplayCheckHandler } from '@replays/application/commands/handlers/start-replay-check.handler';
import { ProposeSearchCandidateCommand } from '@replays/application/commands/propose-search-candidate.command';
import { RecordFailureCauseCommand } from '@replays/application/commands/record-failure-cause.command';
import { StartReplayCheckCommand } from '@replays/application/commands/start-replay-check.command';
import {
  CHANGE_JUDGE,
  type ChangeJudgePort,
} from '@replays/application/ports/change-judge.port';
import {
  CHANGE_REVIEW,
  type ChangeReviewPort,
} from '@replays/application/ports/change-review.port';
import {
  CONFIG_REPOSITORY,
  type ConfigRepositoryPort,
} from '@replays/application/ports/config-repository.port';
import { HASH, type HashPort } from '@replays/application/ports/hash.port';
import {
  INSIGHTS,
  type InsightsPort,
} from '@replays/application/ports/insights.port';
import {
  PAIR_JUDGE,
  type PairJudgePort,
} from '@replays/application/ports/pair-judge.port';
import {
  PEOPLE,
  type PeoplePort,
} from '@replays/application/ports/people.port';
import {
  REPLAYS_READER,
  type ReplaysReaderPort,
} from '@replays/application/ports/replays-reader.port';
import {
  SEARCH_NOTICES,
  type SearchNoticesPort,
} from '@replays/application/ports/search-notices.port';
import {
  STATION_SOURCE_EDITOR,
  type StationSourceEditorPort,
} from '@replays/application/ports/station-source-editor.port';
import { WORK, type WorkPort } from '@replays/application/ports/work.port';
import { ReadReplayCheckHandler } from '@replays/application/queries/handlers/read-replay-check.handler';
import { ReadReplayedCandidatesHandler } from '@replays/application/queries/handlers/read-replayed-candidates.handler';
import { ReadReplayCheckQuery } from '@replays/application/queries/read-replay-check.query';
import { ReadReplayedCandidatesQuery } from '@replays/application/queries/read-replayed-candidates.query';
import { SearchVisibilities } from '@replays/application/queries/search-visibilities';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { AutoSearches } from '@replays/application/services/auto-searches.service';
import { CancelReplayRuns } from '@replays/application/services/cancel-replay-runs.service';
import { CancelSearch } from '@replays/application/services/cancel-search.service';
import { CheckEvaluations } from '@replays/application/services/check-evaluations.service';
import { CheckSearchReadiness } from '@replays/application/services/check-search-readiness.service';
import { CloseStaleConfigPullRequests } from '@replays/application/services/close-stale-config-pull-requests.service';
import { DeleteChangeJudgings } from '@replays/application/services/delete-change-judgings.service';
import { DeleteConfigPullRequests } from '@replays/application/services/delete-config-pull-requests.service';
import { DeleteLineSearchBudgets } from '@replays/application/services/delete-line-search-budgets.service';
import { DeleteReplayChecks } from '@replays/application/services/delete-replay-checks.service';
import { DeleteReplays } from '@replays/application/services/delete-replays.service';
import { DeleteSearches } from '@replays/application/services/delete-searches.service';
import { DeleteSideBySideJudgings } from '@replays/application/services/delete-side-by-side-judgings.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { DispatchSearchIteration } from '@replays/application/services/dispatch-search-iteration.service';
import { EnsureCheckBaselines } from '@replays/application/services/ensure-check-baselines.service';
import { FollowConfigPullRequests } from '@replays/application/services/follow-config-pull-requests.service';
import { HoldOutSearch } from '@replays/application/services/hold-out-search.service';
import { HoldSetStartingPoints } from '@replays/application/services/hold-set-starting-points.service';
import { KeepReplaySets } from '@replays/application/services/keep-replay-sets.service';
import { LiveCandidates } from '@replays/application/services/live-candidates.service';
import { NoticeSearchResults } from '@replays/application/services/notice-search-results.service';
import { OpenConfigPullRequests } from '@replays/application/services/open-config-pull-requests.service';
import { PairReplayEntries } from '@replays/application/services/pair-replay-entries.service';
import { PendingSearchSteps } from '@replays/application/services/pending-search-steps.service';
import { PickSearchCandidates } from '@replays/application/services/pick-search-candidates.service';
import { ReconcileConfigPullRequests } from '@replays/application/services/reconcile-config-pull-requests.service';
import { RecordLineChange } from '@replays/application/services/record-line-change.service';
import { RecordReplayChangeReview } from '@replays/application/services/record-replay-change-review.service';
import { RecordReplayPairVerdict } from '@replays/application/services/record-replay-pair-verdict.service';
import { RecordReplayRunEnding } from '@replays/application/services/record-replay-run-ending.service';
import { RecordReplayRunUsage } from '@replays/application/services/record-replay-run-usage.service';
import { RecordReplayVerdict } from '@replays/application/services/record-replay-verdict.service';
import { RecordSearchProgress } from '@replays/application/services/record-search-progress.service';
import { RefreshReplaySets } from '@replays/application/services/refresh-replay-sets.service';
import { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { RequestChangeJudging } from '@replays/application/services/request-change-judging.service';
import { RequestReplayJudging } from '@replays/application/services/request-replay-judging.service';
import { RequestReplayRecheck } from '@replays/application/services/request-replay-recheck.service';
import { RequestReplayRejudging } from '@replays/application/services/request-replay-rejudging.service';
import { RequestReplaySideBySideJudging } from '@replays/application/services/request-replay-side-by-side-judging.service';
import { RequestSideBySideJudging } from '@replays/application/services/request-side-by-side-judging.service';
import { SearchFindings } from '@replays/application/services/search-findings.service';
import { SearchSchedules } from '@replays/application/services/search-schedules.service';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { SetStations } from '@replays/application/services/set-stations.service';
import { SetUsage } from '@replays/application/services/set-usage.service';
import { StartCheckReplays } from '@replays/application/services/start-check-replays.service';
import { StartOracleReplay } from '@replays/application/services/start-oracle-replay.service';
import { StartSearch } from '@replays/application/services/start-search.service';
import { StartSearchReplays } from '@replays/application/services/start-search-replays.service';
import { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import { StationChangeTests } from '@replays/application/services/station-change-tests.service';
import { TurnOffSearches } from '@replays/application/services/turn-off-searches.service';
import { WorkChangeJudgings } from '@replays/application/services/work-change-judgings.service';
import { WorkSideBySideJudgings } from '@replays/application/services/work-side-by-side-judgings.service';
import { ChangeReview } from '@replays/infrastructure/acl/change-review.adapter';
import { ConfigRepository } from '@replays/infrastructure/acl/config-repository.adapter';
import { ConfigurationStationSourceEditor } from '@replays/infrastructure/acl/configuration-station-source.editor';
import { Insights } from '@replays/infrastructure/acl/insights.adapter';
import { InsightsChangeJudge } from '@replays/infrastructure/acl/insights-change-judge.adapter';
import { InsightsPairJudge } from '@replays/infrastructure/acl/insights-pair-judge.adapter';
import { People } from '@replays/infrastructure/acl/people.adapter';
import { SearchNotices } from '@replays/infrastructure/acl/search-notices.adapter';
import { WorkSearchVisibility } from '@replays/infrastructure/acl/search-visibility.adapter';
import { WorkStationChangeTests } from '@replays/infrastructure/acl/station-change-tests.adapter';
import { Work } from '@replays/infrastructure/acl/work.adapter';
import { REPLAYS_PAYLOAD_TYPES } from '@replays/infrastructure/events/replays-payload-types';
import { Sha256Hash } from '@replays/infrastructure/hashing/sha256-hash';
import { DrizzleReplaysReader } from '@replays/infrastructure/persistence/drizzle/readers/replays.reader';
import { DrizzleStationConfigPullRequests } from '@replays/infrastructure/persistence/drizzle/readers/station-config-pull-requests.reader';
import { DrizzleCandidateRepository } from '@replays/infrastructure/persistence/drizzle/repositories/candidate.repository';
import { DrizzleChangeJudgingRepository } from '@replays/infrastructure/persistence/drizzle/repositories/change-judging.repository';
import { DrizzleConfigPullRequestRepository } from '@replays/infrastructure/persistence/drizzle/repositories/config-pull-request.repository';
import { DrizzleLineSearchBudgetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/line-search-budget.repository';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { DrizzleReplayCheckRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-check.repository';
import { DrizzleReplaySetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-set.repository';
import { DrizzleSearchRepository } from '@replays/infrastructure/persistence/drizzle/repositories/search.repository';
import { DrizzleSideBySideJudgingRepository } from '@replays/infrastructure/persistence/drizzle/repositories/side-by-side-judging.repository';
import { DrizzleStationSearchScheduleRepository } from '@replays/infrastructure/persistence/drizzle/repositories/station-search-schedule.repository';
import { replaysSubscribers } from '@replays/presentation/events/replays.subscribers';
import { ReplayChecksController } from '@replays/presentation/http/controllers/replay-checks.controller';
import { ReplayedCandidatesController } from '@replays/presentation/http/controllers/replayed-candidates.controller';
import { RunnerFailureCausesController } from '@replays/presentation/http/controllers/runner-failure-causes.controller';
import { RunnerSearchCandidatesController } from '@replays/presentation/http/controllers/runner-search-candidates.controller';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  ERROR_REPORTS,
  type ErrorReportsPort,
} from '@shared-kernel/application/ports/error-reports.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import { IDEMPOTENT_LOOKUPS } from '@shared-kernel/application/ports/idempotent-lookups.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import {
  NOTICES,
  type NoticesPort,
} from '@work/application/ports/notices.port';
import {
  REPLAY_CANDIDATES,
  type ReplayCandidatesPort,
} from '@work/application/ports/replay-candidates.port';
import {
  REPLAY_DISPATCH,
  type ReplayDispatchPort,
} from '@work/application/ports/replay-dispatch.port';
import {
  REPLAYABLE_RUNS,
  type ReplayableRunsPort,
} from '@work/application/ports/replayable-runs.port';
import {
  SEARCH_DISPATCH,
  type SearchDispatchPort,
} from '@work/application/ports/search-dispatch.port';
import {
  SEARCH_RUNS,
  type SearchRunsPort,
} from '@work/application/ports/search-runs.port';
import { SEARCH_VISIBILITY } from '@work/application/ports/search-visibility.port';
import {
  STARTING_POINT_HOLDS,
  type StartingPointHoldsPort,
} from '@work/application/ports/starting-point-holds.port';
import { STATION_CHANGE_TESTS } from '@work/application/ports/station-change-tests.port';

const REPLAYS_EVENTS = Symbol('REPLAYS_EVENTS');

export const REPLAYS_CONTROLLERS: readonly Type[] = [
  ReplayChecksController,
  RunnerSearchCandidatesController,
  RunnerFailureCausesController,
  ReplayedCandidatesController,
];

export const REPLAYS_PROVIDERS: readonly Provider[] = [
  {
    provide: SearchVisibilities,
    inject: [
      DrizzleSearchRepository,
      DrizzleCandidateRepository,
      DrizzleReplayRepository,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      candidates: DrizzleCandidateRepository,
      replays: DrizzleReplayRepository,
    ) => new SearchVisibilities(searches, candidates, replays),
  },
  {
    provide: SEARCH_VISIBILITY,
    inject: [SearchVisibilities],
    useFactory: (visibilities: SearchVisibilities) =>
      new WorkSearchVisibility(visibilities),
  },
  { provide: HASH, useClass: Sha256Hash },
  DrizzleReplaySetRepository,
  DrizzleCandidateRepository,
  DrizzleReplayRepository,
  DrizzleSearchRepository,
  DrizzleReplayCheckRepository,
  DrizzleConfigPullRequestRepository,
  DrizzleStationSearchScheduleRepository,
  DrizzleLineSearchBudgetRepository,
  {
    provide: CONFIG_REPOSITORY,
    inject: [REPOSITORY_CONTENTS, PULL_REQUESTS],
    useFactory: (
      contents: RepositoryContentsPort,
      pullRequests: PullRequestPort,
    ) => new ConfigRepository(contents, pullRequests),
  },
  {
    provide: STATION_SOURCE_EDITOR,
    inject: [STATION_SOURCE_EDITS],
    useFactory: (edits: StationSourceEditsPort) =>
      new ConfigurationStationSourceEditor(edits),
  },
  {
    provide: SEARCH_NOTICES,
    inject: [NOTICES],
    useFactory: (notices: NoticesPort) => new SearchNotices(notices),
  },
  {
    provide: WORK,
    inject: [
      REPLAYABLE_RUNS,
      REPLAY_CANDIDATES,
      REPLAY_DISPATCH,
      STARTING_POINT_HOLDS,
      SEARCH_DISPATCH,
      SEARCH_RUNS,
    ],
    useFactory: (
      runs: ReplayableRunsPort,
      candidates: ReplayCandidatesPort,
      dispatching: ReplayDispatchPort,
      startingPointHolds: StartingPointHoldsPort,
      searching: SearchDispatchPort,
      searchRuns: SearchRunsPort,
    ) =>
      new Work(
        runs,
        candidates,
        dispatching,
        startingPointHolds,
        searching,
        searchRuns,
      ),
  },
  {
    provide: CHANGE_REVIEW,
    inject: [RUN_CHANGE_CHECKS, REPLAY_RECHECKS],
    useFactory: (checks: RunChangeChecksPort, rechecks: ReplayRechecksPort) =>
      new ChangeReview(checks, rechecks),
  },
  {
    provide: INSIGHTS,
    inject: [RUN_ACCEPTANCE],
    useFactory: (acceptance: RunAcceptancePort) => new Insights(acceptance),
  },
  {
    provide: CHANGE_JUDGE,
    inject: [CHANGE_JUDGMENTS],
    useFactory: (judgments: ChangeJudgmentsPort) =>
      new InsightsChangeJudge(judgments),
  },
  {
    provide: PAIR_JUDGE,
    inject: [PAIR_JUDGMENTS],
    useFactory: (judgments: PairJudgmentsPort) =>
      new InsightsPairJudge(judgments),
  },
  DrizzleChangeJudgingRepository,
  DrizzleSideBySideJudgingRepository,
  DrizzleReplaysReader,
  { provide: REPLAYS_READER, useExisting: DrizzleReplaysReader },
  DrizzleStationConfigPullRequests,
  {
    provide: STATION_CONFIG_PULL_REQUESTS,
    useExisting: DrizzleStationConfigPullRequests,
  },
  {
    provide: RequestChangeJudging,
    inject: [DrizzleChangeJudgingRepository, CHANGE_JUDGE, TRANSACTION, CLOCK],
    useFactory: (
      judgings: DrizzleChangeJudgingRepository,
      judge: ChangeJudgePort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RequestChangeJudging(judgings, judge, transaction, clock),
  },
  {
    provide: RequestSideBySideJudging,
    inject: [
      DrizzleSideBySideJudgingRepository,
      PAIR_JUDGE,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      judgings: DrizzleSideBySideJudgingRepository,
      judge: PairJudgePort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RequestSideBySideJudging(judgings, judge, transaction, clock),
  },
  {
    provide: WorkChangeJudgings,
    inject: [
      DrizzleChangeJudgingRepository,
      CHANGE_JUDGE,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
      TELEMETRY,
    ],
    useFactory: (
      judgings: DrizzleChangeJudgingRepository,
      judge: ChangeJudgePort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
      telemetry: TelemetryPort,
    ) =>
      new WorkChangeJudgings(
        judgings,
        judge,
        clock,
        transaction,
        logger,
        reports,
        telemetry,
      ),
  },
  {
    provide: WorkSideBySideJudgings,
    inject: [
      DrizzleSideBySideJudgingRepository,
      PAIR_JUDGE,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
      TELEMETRY,
    ],
    useFactory: (
      judgings: DrizzleSideBySideJudgingRepository,
      judge: PairJudgePort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
      telemetry: TelemetryPort,
    ) =>
      new WorkSideBySideJudgings(
        judgings,
        judge,
        clock,
        transaction,
        logger,
        reports,
        telemetry,
      ),
  },
  {
    provide: DeleteLineSearchBudgets,
    inject: [DrizzleLineSearchBudgetRepository, TRANSACTION],
    useFactory: (
      budgets: DrizzleLineSearchBudgetRepository,
      transaction: TransactionPort,
    ) => new DeleteLineSearchBudgets(budgets, transaction),
  },
  {
    provide: StartSearchReplays,
    inject: [
      DrizzleSearchRepository,
      DrizzleReplayRepository,
      DrizzleCandidateRepository,
      DrizzleReplaySetRepository,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      sets: DrizzleReplaySetRepository,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new StartSearchReplays(
        searches,
        replays,
        candidates,
        sets,
        clock,
        transaction,
      ),
  },
  {
    provide: StartCheckReplays,
    inject: [
      DrizzleReplayCheckRepository,
      DrizzleReplayRepository,
      DrizzleCandidateRepository,
      DrizzleReplaySetRepository,
      LiveCandidates,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      checks: DrizzleReplayCheckRepository,
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      sets: DrizzleReplaySetRepository,
      snapshots: LiveCandidates,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new StartCheckReplays(
        checks,
        replays,
        candidates,
        sets,
        snapshots,
        ids,
        clock,
        transaction,
      ),
  },
  {
    provide: DeleteChangeJudgings,
    inject: [DrizzleChangeJudgingRepository, TRANSACTION],
    useFactory: (
      judgings: DrizzleChangeJudgingRepository,
      transaction: TransactionPort,
    ) => new DeleteChangeJudgings(judgings, transaction),
  },
  {
    provide: DeleteSideBySideJudgings,
    inject: [DrizzleSideBySideJudgingRepository, TRANSACTION],
    useFactory: (
      judgings: DrizzleSideBySideJudgingRepository,
      transaction: TransactionPort,
    ) => new DeleteSideBySideJudgings(judgings, transaction),
  },
  {
    provide: PEOPLE,
    inject: [WORKSPACE_ACCESS, TEAM_DIRECTORY],
    useFactory: (access: WorkspaceAccessPort, teams: TeamDirectoryPort) =>
      new People(access, teams),
  },
  {
    provide: ReplaysAccess,
    inject: [
      PEOPLE,
      WORK,
      DrizzleReplaySetRepository,
      DrizzleReplayRepository,
      DrizzleSearchRepository,
    ],
    useFactory: (
      people: PeoplePort,
      work: WorkPort,
      sets: DrizzleReplaySetRepository,
      replays: DrizzleReplayRepository,
      searches: DrizzleSearchRepository,
    ) => new ReplaysAccess(people, work, sets, replays, searches),
  },
  {
    provide: SetHealths,
    inject: [WORK, DrizzleReplayRepository, DrizzleCandidateRepository],
    useFactory: (
      work: WorkPort,
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
    ) => new SetHealths(work, replays, candidates),
  },
  {
    provide: CheckEvaluations,
    inject: [DrizzleReplayRepository, DrizzleReplaySetRepository],
    useFactory: (
      replays: DrizzleReplayRepository,
      sets: DrizzleReplaySetRepository,
    ) => new CheckEvaluations(replays, sets),
  },
  ...bindCommandHandler(StartReplayCheckCommand, StartReplayCheckHandler, [
    ReplaysAccess,
    PEOPLE,
    WORK,
    LiveCandidates,
    StartCheckReplays,
    CheckEvaluations,
    DrizzleReplaySetRepository,
    DrizzleReplayCheckRepository,
    IDEMPOTENT_CREATES,
    IDEMPOTENT_LOOKUPS,
    HASH,
    ID_GENERATOR,
    CLOCK,
    TRANSACTION,
    LOGGER,
  ]),
  ...bindQueryHandler(ReadReplayCheckQuery, ReadReplayCheckHandler, [
    ReplaysAccess,
    WORK,
    DrizzleReplayCheckRepository,
    CheckEvaluations,
  ]),
  {
    provide: DeleteReplayChecks,
    inject: [DrizzleReplayCheckRepository, TRANSACTION],
    useFactory: (
      checks: DrizzleReplayCheckRepository,
      transaction: TransactionPort,
    ) => new DeleteReplayChecks(checks, transaction),
  },
  ...bindCommandHandler(
    ProposeSearchCandidateCommand,
    ProposeSearchCandidateHandler,
    [
      PEOPLE,
      WORK,
      DrizzleSearchRepository,
      DrizzleCandidateRepository,
      LiveCandidates,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(RecordFailureCauseCommand, RecordFailureCauseHandler, [
    WORK,
    DrizzleSearchRepository,
    CLOCK,
    TRANSACTION,
  ]),
  {
    provide: OpenConfigPullRequests,
    inject: [
      DrizzleConfigPullRequestRepository,
      DrizzleSearchRepository,
      DrizzleCandidateRepository,
      DrizzleReplayRepository,
      WORK,
      PEOPLE,
      CONFIG_REPOSITORY,
      STATION_SOURCE_EDITOR,
      TRANSACTION,
      CLOCK,
      LOGGER,
      SetHealths,
      DrizzleReplaySetRepository,
      SearchFindings,
    ],
    useFactory: (
      pullRequests: DrizzleConfigPullRequestRepository,
      searches: DrizzleSearchRepository,
      candidates: DrizzleCandidateRepository,
      replays: DrizzleReplayRepository,
      work: WorkPort,
      people: PeoplePort,
      configs: ConfigRepositoryPort,
      editor: StationSourceEditorPort,
      transaction: TransactionPort,
      clock: ClockPort,
      logger: LoggerPort,
      healths: SetHealths,
      sets: DrizzleReplaySetRepository,
      findings: SearchFindings,
    ) =>
      new OpenConfigPullRequests(
        pullRequests,
        searches,
        candidates,
        replays,
        work,
        people,
        configs,
        editor,
        transaction,
        clock,
        logger,
        healths,
        sets,
        findings,
      ),
  },
  {
    provide: CloseStaleConfigPullRequests,
    inject: [
      DrizzleConfigPullRequestRepository,
      CONFIG_REPOSITORY,
      TRANSACTION,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      pullRequests: DrizzleConfigPullRequestRepository,
      configs: ConfigRepositoryPort,
      transaction: TransactionPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new CloseStaleConfigPullRequests(
        pullRequests,
        configs,
        transaction,
        clock,
        logger,
      ),
  },
  {
    provide: ReconcileConfigPullRequests,
    inject: [
      DrizzleConfigPullRequestRepository,
      CONFIG_REPOSITORY,
      TRANSACTION,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      pullRequests: DrizzleConfigPullRequestRepository,
      configs: ConfigRepositoryPort,
      transaction: TransactionPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new ReconcileConfigPullRequests(
        pullRequests,
        configs,
        transaction,
        clock,
        logger,
      ),
  },
  {
    provide: FollowConfigPullRequests,
    inject: [DrizzleConfigPullRequestRepository, WORK, TRANSACTION, CLOCK],
    useFactory: (
      pullRequests: DrizzleConfigPullRequestRepository,
      work: WorkPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new FollowConfigPullRequests(pullRequests, work, transaction, clock),
  },
  {
    provide: DeleteConfigPullRequests,
    inject: [DrizzleConfigPullRequestRepository, TRANSACTION],
    useFactory: (
      pullRequests: DrizzleConfigPullRequestRepository,
      transaction: TransactionPort,
    ) => new DeleteConfigPullRequests(pullRequests, transaction),
  },
  ...bindQueryHandler(
    ReadReplayedCandidatesQuery,
    ReadReplayedCandidatesHandler,
    [
      ReplaysAccess,
      REPLAYS_READER,
      DrizzleSearchRepository,
      DrizzleReplaySetRepository,
      DrizzleCandidateRepository,
      WORK,
      CLOCK,
      SetHealths,
    ],
  ),
  {
    provide: DispatchReplayRuns,
    inject: [
      DrizzleReplayRepository,
      DrizzleCandidateRepository,
      DrizzleSearchRepository,
      WORK,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      searches: DrizzleSearchRepository,
      work: WorkPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new DispatchReplayRuns(
        replays,
        candidates,
        searches,
        work,
        ids,
        clock,
        transaction,
        logger,
      ),
  },
  {
    provide: RecordSearchProgress,
    inject: [
      DrizzleSearchRepository,
      DrizzleReplayRepository,
      SetHealths,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      replays: DrizzleReplayRepository,
      healths: SetHealths,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new RecordSearchProgress(
        searches,
        replays,
        healths,
        ids,
        clock,
        transaction,
      ),
  },
  {
    provide: DispatchSearchIteration,
    inject: [
      DrizzleSearchRepository,
      DrizzleCandidateRepository,
      DrizzleReplayRepository,
      SetHealths,
      WORK,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      candidates: DrizzleCandidateRepository,
      replays: DrizzleReplayRepository,
      healths: SetHealths,
      work: WorkPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new DispatchSearchIteration(
        searches,
        candidates,
        replays,
        healths,
        work,
        ids,
        clock,
        transaction,
      ),
  },
  {
    provide: HoldOutSearch,
    inject: [
      DrizzleSearchRepository,
      DrizzleReplayRepository,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      SetHealths,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      replays: DrizzleReplayRepository,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
      healths: SetHealths,
    ) => new HoldOutSearch(searches, replays, ids, clock, transaction, healths),
  },
  {
    provide: CancelSearch,
    inject: [DrizzleReplayRepository, WORK, CLOCK, TRANSACTION],
    useFactory: (
      replays: DrizzleReplayRepository,
      work: WorkPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => new CancelSearch(replays, work, clock, transaction),
  },
  {
    provide: DeleteSearches,
    inject: [DrizzleSearchRepository, WORK, CLOCK, TRANSACTION],
    useFactory: (
      searches: DrizzleSearchRepository,
      work: WorkPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => new DeleteSearches(searches, work, clock, transaction),
  },
  {
    provide: AdvanceSearches,
    inject: [
      DrizzleSearchRepository,
      DrizzleReplayRepository,
      WORK,
      DispatchSearchIteration,
      HoldOutSearch,
      RecordSearchProgress,
      CancelSearch,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      replays: DrizzleReplayRepository,
      work: WorkPort,
      dispatching: DispatchSearchIteration,
      holdingOut: HoldOutSearch,
      recording: RecordSearchProgress,
      cancellingSearches: CancelSearch,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new AdvanceSearches(
        searches,
        replays,
        work,
        dispatching,
        holdingOut,
        recording,
        cancellingSearches,
        clock,
        logger,
      ),
  },
  {
    provide: EnsureCheckBaselines,
    inject: [
      DrizzleReplayCheckRepository,
      CheckEvaluations,
      DrizzleReplaySetRepository,
      DrizzleReplayRepository,
      WORK,
      LiveCandidates,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      checks: DrizzleReplayCheckRepository,
      evaluations: CheckEvaluations,
      sets: DrizzleReplaySetRepository,
      replays: DrizzleReplayRepository,
      work: WorkPort,
      snapshots: LiveCandidates,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new EnsureCheckBaselines(
        checks,
        evaluations,
        sets,
        replays,
        work,
        snapshots,
        ids,
        clock,
        transaction,
        logger,
      ),
  },
  {
    provide: SetUsage,
    inject: [
      DrizzleSearchRepository,
      DrizzleReplayRepository,
      DrizzleReplayCheckRepository,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      replays: DrizzleReplayRepository,
      checks: DrizzleReplayCheckRepository,
    ) => new SetUsage(searches, replays, checks),
  },
  {
    provide: RefreshReplaySets,
    inject: [
      DrizzleReplaySetRepository,
      DrizzleSearchRepository,
      SetUsage,
      WORK,
      INSIGHTS,
      CLOCK,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      sets: DrizzleReplaySetRepository,
      searches: DrizzleSearchRepository,
      usage: SetUsage,
      work: WorkPort,
      insights: InsightsPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new RefreshReplaySets(
        sets,
        searches,
        usage,
        work,
        insights,
        clock,
        transaction,
        logger,
      ),
  },
  {
    provide: KeepReplaySets,
    inject: [
      DrizzleReplaySetRepository,
      DrizzleStationSearchScheduleRepository,
      WORK,
      PEOPLE,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      sets: DrizzleReplaySetRepository,
      schedules: DrizzleStationSearchScheduleRepository,
      work: WorkPort,
      people: PeoplePort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new KeepReplaySets(sets, schedules, work, people, ids, clock),
  },
  {
    provide: StartSearch,
    inject: [
      LiveCandidates,
      PendingSearchSteps,
      DrizzleReplaySetRepository,
      DrizzleSearchRepository,
      DrizzleStationSearchScheduleRepository,
      DrizzleLineSearchBudgetRepository,
      HASH,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      snapshots: LiveCandidates,
      steps: PendingSearchSteps,
      sets: DrizzleReplaySetRepository,
      searches: DrizzleSearchRepository,
      schedules: DrizzleStationSearchScheduleRepository,
      budgets: DrizzleLineSearchBudgetRepository,
      hash: HashPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new StartSearch(
        snapshots,
        steps,
        sets,
        searches,
        schedules,
        budgets,
        hash,
        ids,
        clock,
        transaction,
      ),
  },
  {
    provide: PendingSearchSteps,
    inject: [
      DrizzleStationSearchScheduleRepository,
      DrizzleSearchRepository,
      DrizzleLineSearchBudgetRepository,
      LiveCandidates,
      CLOCK,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      schedules: DrizzleStationSearchScheduleRepository,
      searches: DrizzleSearchRepository,
      budgets: DrizzleLineSearchBudgetRepository,
      snapshots: LiveCandidates,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new PendingSearchSteps(
        schedules,
        searches,
        budgets,
        snapshots,
        clock,
        transaction,
        logger,
      ),
  },
  {
    provide: AutoSearches,
    inject: [
      DrizzleStationSearchScheduleRepository,
      DrizzleReplaySetRepository,
      DrizzleSearchRepository,
      DrizzleConfigPullRequestRepository,
      RefreshReplaySets,
      CheckSearchReadiness,
      StartSearch,
      WORK,
      CLOCK,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      schedules: DrizzleStationSearchScheduleRepository,
      sets: DrizzleReplaySetRepository,
      searches: DrizzleSearchRepository,
      pullRequests: DrizzleConfigPullRequestRepository,
      refreshing: RefreshReplaySets,
      readiness: CheckSearchReadiness,
      starting: StartSearch,
      work: WorkPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new AutoSearches(
        schedules,
        sets,
        searches,
        pullRequests,
        refreshing,
        readiness,
        starting,
        work,
        clock,
        transaction,
        logger,
      ),
  },
  {
    provide: STATION_CHANGE_TESTS,
    inject: [StationChangeTests],
    useFactory: (tests: StationChangeTests) =>
      new WorkStationChangeTests(tests),
  },
  {
    provide: StationChangeTests,
    inject: [
      WORK,
      PEOPLE,
      DrizzleStationSearchScheduleRepository,
      DrizzleReplaySetRepository,
      DrizzleSearchRepository,
      DrizzleCandidateRepository,
      DrizzleConfigPullRequestRepository,
      RefreshReplaySets,
      CheckSearchReadiness,
      StartSearch,
      LiveCandidates,
      PendingSearchSteps,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      work: WorkPort,
      people: PeoplePort,
      schedules: DrizzleStationSearchScheduleRepository,
      sets: DrizzleReplaySetRepository,
      searches: DrizzleSearchRepository,
      candidates: DrizzleCandidateRepository,
      pullRequests: DrizzleConfigPullRequestRepository,
      refreshing: RefreshReplaySets,
      readiness: CheckSearchReadiness,
      starting: StartSearch,
      snapshots: LiveCandidates,
      steps: PendingSearchSteps,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new StationChangeTests(
        work,
        people,
        schedules,
        sets,
        searches,
        candidates,
        pullRequests,
        refreshing,
        readiness,
        starting,
        snapshots,
        steps,
        ids,
        clock,
        transaction,
      ),
  },
  {
    provide: CheckSearchReadiness,
    inject: [
      DrizzleReplaySetRepository,
      SetHealths,
      WORK,
      HASH,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      sets: DrizzleReplaySetRepository,
      healths: SetHealths,
      work: WorkPort,
      hash: HashPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new CheckSearchReadiness(sets, healths, work, hash, ids, clock),
  },
  {
    provide: SearchSchedules,
    inject: [DrizzleStationSearchScheduleRepository, WORK, TRANSACTION, CLOCK],
    useFactory: (
      schedules: DrizzleStationSearchScheduleRepository,
      work: WorkPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new SearchSchedules(schedules, work, transaction, clock),
  },
  {
    provide: TurnOffSearches,
    inject: [DrizzleSearchRepository, WORK, TRANSACTION, CLOCK],
    useFactory: (
      searches: DrizzleSearchRepository,
      work: WorkPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new TurnOffSearches(searches, work, transaction, clock),
  },
  {
    provide: PickSearchCandidates,
    inject: [
      DrizzleSearchRepository,
      DrizzleReplayRepository,
      DrizzleConfigPullRequestRepository,
      DrizzleCandidateRepository,
      DrizzleStationSearchScheduleRepository,
      SetHealths,
      WORK,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      replays: DrizzleReplayRepository,
      pullRequests: DrizzleConfigPullRequestRepository,
      candidates: DrizzleCandidateRepository,
      schedules: DrizzleStationSearchScheduleRepository,
      healths: SetHealths,
      work: WorkPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new PickSearchCandidates(
        searches,
        replays,
        pullRequests,
        candidates,
        schedules,
        healths,
        work,
        ids,
        clock,
        transaction,
      ),
  },
  {
    provide: SearchFindings,
    inject: [WORK],
    useFactory: (work: WorkPort) => new SearchFindings(work),
  },
  {
    provide: NoticeSearchResults,
    inject: [
      DrizzleSearchRepository,
      DrizzleConfigPullRequestRepository,
      DrizzleCandidateRepository,
      DrizzleReplayRepository,
      SetHealths,
      SearchFindings,
      WORK,
      SEARCH_NOTICES,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      pullRequests: DrizzleConfigPullRequestRepository,
      candidates: DrizzleCandidateRepository,
      replays: DrizzleReplayRepository,
      healths: SetHealths,
      findings: SearchFindings,
      work: WorkPort,
      notices: SearchNoticesPort,
    ) =>
      new NoticeSearchResults(
        searches,
        pullRequests,
        candidates,
        replays,
        healths,
        findings,
        work,
        notices,
      ),
  },
  {
    provide: PendingJobWorker,
    inject: [
      DispatchReplayRuns,
      AdvanceSearches,
      OpenConfigPullRequests,
      CloseStaleConfigPullRequests,
      ReconcileConfigPullRequests,
      EnsureCheckBaselines,
      RefreshReplaySets,
      AutoSearches,
      PendingSearchSteps,
      WorkChangeJudgings,
      WorkSideBySideJudgings,
      LOGGER,
    ],
    useFactory: (
      dispatching: DispatchReplayRuns,
      advancing: AdvanceSearches,
      opening: OpenConfigPullRequests,
      closing: CloseStaleConfigPullRequests,
      reconciling: ReconcileConfigPullRequests,
      baselines: EnsureCheckBaselines,
      refreshing: RefreshReplaySets,
      searching: AutoSearches,
      steps: PendingSearchSteps,
      changes: WorkChangeJudgings,
      pairs: WorkSideBySideJudgings,
      logger: LoggerPort,
    ) =>
      new PendingJobWorker(
        [
          dispatching,
          advancing,
          opening,
          closing,
          reconciling,
          baselines,
          refreshing,
          searching,
          steps,
          changes,
          pairs,
        ],
        logger,
      ),
  },
  {
    provide: RecordReplayRunEnding,
    inject: [DrizzleReplayRepository, CHANGE_REVIEW, TRANSACTION, CLOCK],
    useFactory: (
      replays: DrizzleReplayRepository,
      changes: ChangeReviewPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RecordReplayRunEnding(replays, changes, transaction, clock),
  },
  {
    provide: RecordReplayChangeReview,
    inject: [DrizzleReplayRepository, CHANGE_REVIEW, TRANSACTION, CLOCK],
    useFactory: (
      replays: DrizzleReplayRepository,
      changes: ChangeReviewPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RecordReplayChangeReview(replays, changes, transaction, clock),
  },
  {
    provide: RequestReplayJudging,
    inject: [
      DrizzleReplayRepository,
      DrizzleCandidateRepository,
      INSIGHTS,
      RequestChangeJudging,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      insights: InsightsPort,
      judgings: RequestChangeJudging,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new RequestReplayJudging(
        replays,
        candidates,
        insights,
        judgings,
        transaction,
        clock,
      ),
  },
  {
    provide: PairReplayEntries,
    inject: [DrizzleReplayRepository, INSIGHTS, TRANSACTION],
    useFactory: (
      replays: DrizzleReplayRepository,
      insights: InsightsPort,
      transaction: TransactionPort,
    ) => new PairReplayEntries(replays, insights, transaction),
  },
  {
    provide: RequestReplaySideBySideJudging,
    inject: [
      DrizzleReplayRepository,
      DrizzleCandidateRepository,
      RequestSideBySideJudging,
      RecordReplayPairVerdict,
    ],
    useFactory: (
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      judgings: RequestSideBySideJudging,
      paired: RecordReplayPairVerdict,
    ) =>
      new RequestReplaySideBySideJudging(replays, candidates, judgings, paired),
  },
  {
    provide: RecordReplayPairVerdict,
    inject: [DrizzleReplayRepository, TRANSACTION],
    useFactory: (
      replays: DrizzleReplayRepository,
      transaction: TransactionPort,
    ) => new RecordReplayPairVerdict(replays, transaction),
  },
  {
    provide: RequestReplayRejudging,
    inject: [RequestChangeJudging, RecordReplayVerdict],
    useFactory: (
      judgings: RequestChangeJudging,
      verdicts: RecordReplayVerdict,
    ) => new RequestReplayRejudging(judgings, verdicts),
  },
  {
    provide: RequestReplayRecheck,
    inject: [CHANGE_REVIEW, RecordReplayChangeReview],
    useFactory: (
      changes: ChangeReviewPort,
      reviewing: RecordReplayChangeReview,
    ) => new RequestReplayRecheck(changes, reviewing),
  },
  {
    provide: RecordReplayVerdict,
    inject: [DrizzleReplayRepository, TRANSACTION, CLOCK],
    useFactory: (
      replays: DrizzleReplayRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RecordReplayVerdict(replays, transaction, clock),
  },
  {
    provide: RecordReplayRunUsage,
    inject: [DrizzleReplayRepository, TRANSACTION, CLOCK],
    useFactory: (
      replays: DrizzleReplayRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RecordReplayRunUsage(replays, transaction, clock),
  },
  {
    provide: HoldSetStartingPoints,
    inject: [DrizzleReplaySetRepository, WORK],
    useFactory: (sets: DrizzleReplaySetRepository, work: WorkPort) =>
      new HoldSetStartingPoints(sets, work),
  },
  {
    provide: CancelReplayRuns,
    inject: [WORK],
    useFactory: (work: WorkPort) => new CancelReplayRuns(work),
  },
  {
    provide: DeleteReplays,
    inject: [
      DrizzleReplaySetRepository,
      DrizzleReplayRepository,
      DrizzleCandidateRepository,
      TRANSACTION,
    ],
    useFactory: (
      sets: DrizzleReplaySetRepository,
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      transaction: TransactionPort,
    ) => new DeleteReplays(sets, replays, candidates, transaction),
  },
  {
    provide: StartWantedBaseline,
    inject: [
      DrizzleReplaySetRepository,
      DrizzleReplayRepository,
      DrizzleCandidateRepository,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      sets: DrizzleReplaySetRepository,
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => new StartWantedBaseline(sets, replays, candidates, clock, transaction),
  },
  {
    provide: StartOracleReplay,
    inject: [
      DrizzleReplaySetRepository,
      DrizzleReplayRepository,
      DrizzleCandidateRepository,
      WORK,
      INSIGHTS,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      sets: DrizzleReplaySetRepository,
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      work: WorkPort,
      insights: InsightsPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new StartOracleReplay(
        sets,
        replays,
        candidates,
        work,
        insights,
        ids,
        clock,
        transaction,
      ),
  },
  {
    provide: LiveCandidates,
    inject: [
      PEOPLE,
      WORK,
      DrizzleCandidateRepository,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      people: PeoplePort,
      work: WorkPort,
      candidates: DrizzleCandidateRepository,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new LiveCandidates(
        people,
        work,
        candidates,
        ids,
        clock,
        transaction,
        logger,
      ),
  },
  {
    provide: SetStations,
    inject: [DrizzleReplaySetRepository, WORK, TRANSACTION, CLOCK],
    useFactory: (
      sets: DrizzleReplaySetRepository,
      work: WorkPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new SetStations(sets, work, transaction, clock),
  },
  {
    provide: RecordLineChange,
    inject: [
      DrizzleReplaySetRepository,
      DrizzleReplayRepository,
      DrizzleCandidateRepository,
      WORK,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      sets: DrizzleReplaySetRepository,
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      work: WorkPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new RecordLineChange(sets, replays, candidates, work, transaction, clock),
  },
  {
    provide: REPLAYS_EVENTS,
    inject: [
      PayloadTypes,
      EventSubscribers,
      RecordReplayRunEnding,
      RecordReplayRunUsage,
      RecordReplayChangeReview,
      RequestReplayJudging,
      RequestReplayRejudging,
      RequestReplayRecheck,
      RecordReplayVerdict,
      PairReplayEntries,
      RequestReplaySideBySideJudging,
      RecordReplayPairVerdict,
      HoldSetStartingPoints,
      KeepReplaySets,
      CancelReplayRuns,
      DeleteReplays,
      RecordLineChange,
      StartWantedBaseline,
      StartOracleReplay,
      RecordSearchProgress,
      DispatchSearchIteration,
      HoldOutSearch,
      CancelSearch,
      DeleteSearches,
      DeleteReplayChecks,
      DeleteConfigPullRequests,
      DeleteChangeJudgings,
      DeleteSideBySideJudgings,
      DeleteLineSearchBudgets,
      StartSearchReplays,
      StartCheckReplays,
      NoticeSearchResults,
      PickSearchCandidates,
      SearchSchedules,
      TurnOffSearches,
      FollowConfigPullRequests,
    ],
    useFactory: (
      types: PayloadTypes,
      subscribers: EventSubscribers,
      ending: RecordReplayRunEnding,
      recordingUsage: RecordReplayRunUsage,
      reviewing: RecordReplayChangeReview,
      requestingJudging: RequestReplayJudging,
      requestingRejudging: RequestReplayRejudging,
      requestingRecheck: RequestReplayRecheck,
      judging: RecordReplayVerdict,
      pairing: PairReplayEntries,
      requestingSideBySideJudging: RequestReplaySideBySideJudging,
      paired: RecordReplayPairVerdict,
      startingPointHolds: HoldSetStartingPoints,
      keeping: KeepReplaySets,
      cancellingRuns: CancelReplayRuns,
      deleting: DeleteReplays,
      lineChanges: RecordLineChange,
      baselines: StartWantedBaseline,
      oracles: StartOracleReplay,
      searching: RecordSearchProgress,
      iterating: DispatchSearchIteration,
      holdingOut: HoldOutSearch,
      cancellingSearches: CancelSearch,
      deletingSearches: DeleteSearches,
      deletingChecks: DeleteReplayChecks,
      deletingPullRequests: DeleteConfigPullRequests,
      deletingChangeJudgings: DeleteChangeJudgings,
      deletingSideBySideJudgings: DeleteSideBySideJudgings,
      deletingBudgets: DeleteLineSearchBudgets,
      startingSearchReplays: StartSearchReplays,
      startingCheckReplays: StartCheckReplays,
      noticingResults: NoticeSearchResults,
      picking: PickSearchCandidates,
      schedules: SearchSchedules,
      turningOff: TurnOffSearches,
      following: FollowConfigPullRequests,
    ) => {
      types.register('replays', REPLAYS_PAYLOAD_TYPES);
      subscribers.register(
        replaysSubscribers({
          ending,
          recordingUsage,
          reviewing,
          requestingJudging,
          requestingRejudging,
          requestingRecheck,
          judging,
          pairing,
          requestingSideBySideJudging: requestingSideBySideJudging,
          paired,
          startingPointHolds,
          keeping,
          cancellingRuns,
          deleting,
          lineChanges,
          baselines,
          oracles,
          searching,
          iterating,
          holdingOut,
          cancellingSearches,
          deletingSearches,
          deletingChecks,
          deletingPullRequests,
          deletingChangeJudgings,
          deletingSideBySideJudgings,
          deletingBudgets,
          startingSearchReplays,
          startingCheckReplays,
          noticingResults,
          picking,
          schedules,
          turningOff,
          following,
        }),
      );
      return true;
    },
  },
];
