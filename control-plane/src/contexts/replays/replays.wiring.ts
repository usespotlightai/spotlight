import {
  REPLAY_RECHECKS,
  type ReplayRechecksPort,
} from '@change-review/application/ports/replay-rechecks.port';
import {
  RUN_CHANGE_CHECKS,
  type RunChangeChecksPort,
} from '@change-review/application/ports/run-change-checks.port';
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
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import {
  CHANGE_JUDGING,
  type ChangeJudgingPort,
} from '@insights/application/ports/change-judging.port';
import {
  RUN_ACCEPTANCE,
  type RunAcceptancePort,
} from '@insights/application/ports/run-acceptance.port';
import {
  SIDE_BY_SIDE_JUDGING,
  type SideBySideJudgingPort,
} from '@insights/application/ports/side-by-side-judging.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { PendingJobWorker } from '@platform/workers/pending-job.worker';
import { DeleteCandidateCommand } from '@replays/application/commands/delete-candidate.command';
import { DeleteCandidateHandler } from '@replays/application/commands/handlers/delete-candidate.handler';
import { ProposeCandidateHandler } from '@replays/application/commands/handlers/propose-candidate.handler';
import { ProposeSearchCandidateHandler } from '@replays/application/commands/handlers/propose-search-candidate.handler';
import { RecordFailureCauseHandler } from '@replays/application/commands/handlers/record-failure-cause.handler';
import { RemoveReplaySetEntryHandler } from '@replays/application/commands/handlers/remove-replay-set-entry.handler';
import { StartReplayHandler } from '@replays/application/commands/handlers/start-replay.handler';
import { StartReplayCheckHandler } from '@replays/application/commands/handlers/start-replay-check.handler';
import { StopReplayHandler } from '@replays/application/commands/handlers/stop-replay.handler';
import { StopSearchHandler } from '@replays/application/commands/handlers/stop-search.handler';
import { ProposeCandidateCommand } from '@replays/application/commands/propose-candidate.command';
import { ProposeSearchCandidateCommand } from '@replays/application/commands/propose-search-candidate.command';
import { RecordFailureCauseCommand } from '@replays/application/commands/record-failure-cause.command';
import { RemoveReplaySetEntryCommand } from '@replays/application/commands/remove-replay-set-entry.command';
import { StartReplayCommand } from '@replays/application/commands/start-replay.command';
import { StartReplayCheckCommand } from '@replays/application/commands/start-replay-check.command';
import { StopReplayCommand } from '@replays/application/commands/stop-replay.command';
import { StopSearchCommand } from '@replays/application/commands/stop-search.command';
import { REPLAYS_EVENT_MAPPERS } from '@replays/application/integration-events/replays.event-mappers';
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
  PEOPLE,
  type PeoplePort,
} from '@replays/application/ports/people.port';
import {
  SEARCH_NOTICES,
  type SearchNoticesPort,
} from '@replays/application/ports/search-notices.port';
import {
  STATION_SOURCE_EDITOR,
  type StationSourceEditorPort,
} from '@replays/application/ports/station-source-editor.port';
import { WORK, type WorkPort } from '@replays/application/ports/work.port';
import { ImportCandidateHandler } from '@replays/application/queries/handlers/import-candidate.handler';
import { ListCandidatesHandler } from '@replays/application/queries/handlers/list-candidates.handler';
import { ListReplaysHandler } from '@replays/application/queries/handlers/list-replays.handler';
import { ListSearchesHandler } from '@replays/application/queries/handlers/list-searches.handler';
import { ListSetReplayChecksHandler } from '@replays/application/queries/handlers/list-set-replay-checks.handler';
import { ListTeamReplaySetsHandler } from '@replays/application/queries/handlers/list-team-replay-sets.handler';
import { ListTeamSearchesHandler } from '@replays/application/queries/handlers/list-team-searches.handler';
import { ReadCandidateHandler } from '@replays/application/queries/handlers/read-candidate.handler';
import { ReadConfigPullRequestHandler } from '@replays/application/queries/handlers/read-config-pull-request.handler';
import { ReadReplayHandler } from '@replays/application/queries/handlers/read-replay.handler';
import { ReadReplayCheckHandler } from '@replays/application/queries/handlers/read-replay-check.handler';
import { ReadReplayOfRunHandler } from '@replays/application/queries/handlers/read-replay-of-run.handler';
import { ReadReplaySetHandler } from '@replays/application/queries/handlers/read-replay-set.handler';
import { ReadReplayedCandidatesHandler } from '@replays/application/queries/handlers/read-replayed-candidates.handler';
import { ReadSearchHandler } from '@replays/application/queries/handlers/read-search.handler';
import { ImportCandidateQuery } from '@replays/application/queries/import-candidate.query';
import { ListCandidatesQuery } from '@replays/application/queries/list-candidates.query';
import { ListReplaysQuery } from '@replays/application/queries/list-replays.query';
import { ListSearchesQuery } from '@replays/application/queries/list-searches.query';
import { ListSetReplayChecksQuery } from '@replays/application/queries/list-set-replay-checks.query';
import { ListTeamReplaySetsQuery } from '@replays/application/queries/list-team-replay-sets.query';
import { ListTeamSearchesQuery } from '@replays/application/queries/list-team-searches.query';
import { ReadCandidateQuery } from '@replays/application/queries/read-candidate.query';
import { ReadConfigPullRequestQuery } from '@replays/application/queries/read-config-pull-request.query';
import { ReadReplayQuery } from '@replays/application/queries/read-replay.query';
import { ReadReplayCheckQuery } from '@replays/application/queries/read-replay-check.query';
import { ReadReplayOfRunQuery } from '@replays/application/queries/read-replay-of-run.query';
import { ReadReplaySetQuery } from '@replays/application/queries/read-replay-set.query';
import { ReadReplayedCandidatesQuery } from '@replays/application/queries/read-replayed-candidates.query';
import { ReadSearchQuery } from '@replays/application/queries/read-search.query';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { AutoSearches } from '@replays/application/services/auto-searches.service';
import { CancelReplayRuns } from '@replays/application/services/cancel-replay-runs.service';
import { CancelSearch } from '@replays/application/services/cancel-search.service';
import { CheckEvaluations } from '@replays/application/services/check-evaluations.service';
import { DeleteConfigPullRequests } from '@replays/application/services/delete-config-pull-requests.service';
import { DeleteReplayChecks } from '@replays/application/services/delete-replay-checks.service';
import { DeleteReplays } from '@replays/application/services/delete-replays.service';
import { DeleteSearches } from '@replays/application/services/delete-searches.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { DispatchSearchIteration } from '@replays/application/services/dispatch-search-iteration.service';
import { EnsureCheckBaselines } from '@replays/application/services/ensure-check-baselines.service';
import { HoldOutSearch } from '@replays/application/services/hold-out-search.service';
import { HoldSetStartingPoints } from '@replays/application/services/hold-set-starting-points.service';
import { KeepReplaySets } from '@replays/application/services/keep-replay-sets.service';
import { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import { NoticeSearchResults } from '@replays/application/services/notice-search-results.service';
import { OpenConfigPullRequests } from '@replays/application/services/open-config-pull-requests.service';
import { PairReplayEntries } from '@replays/application/services/pair-replay-entries.service';
import { PickSearchCandidates } from '@replays/application/services/pick-search-candidates.service';
import { RecordLineChange } from '@replays/application/services/record-line-change.service';
import { RecordReplayChangeReview } from '@replays/application/services/record-replay-change-review.service';
import { RecordReplayPairVerdict } from '@replays/application/services/record-replay-pair-verdict.service';
import { RecordReplayRunEnding } from '@replays/application/services/record-replay-run-ending.service';
import { RecordReplayRunUsage } from '@replays/application/services/record-replay-run-usage.service';
import { RecordReplayVerdict } from '@replays/application/services/record-replay-verdict.service';
import { RecordSearchProgress } from '@replays/application/services/record-search-progress.service';
import { RefreshKeptSets } from '@replays/application/services/refresh-kept-sets.service';
import { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { RequestReplayJudging } from '@replays/application/services/request-replay-judging.service';
import { RequestReplayRecheck } from '@replays/application/services/request-replay-recheck.service';
import { RequestReplayRejudging } from '@replays/application/services/request-replay-rejudging.service';
import { RequestReplaySideBySideJudging } from '@replays/application/services/request-replay-side-by-side-judging.service';
import { SearchSchedules } from '@replays/application/services/search-schedules.service';
import { SearchSummaries } from '@replays/application/services/search-summaries.service';
import { SearchVisibilities } from '@replays/application/services/search-visibilities.service';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { SetStations } from '@replays/application/services/set-stations.service';
import { SetUsage } from '@replays/application/services/set-usage.service';
import { StartOracleReplay } from '@replays/application/services/start-oracle-replay.service';
import { StartSearch } from '@replays/application/services/start-search.service';
import { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import { REPLAYS_PAYLOAD_TYPES } from '@replays/domain/payload-types';
import { ChangeReview } from '@replays/infrastructure/acl/change-review.adapter';
import { ConfigRepository } from '@replays/infrastructure/acl/config-repository.adapter';
import { Insights } from '@replays/infrastructure/acl/insights.adapter';
import { People } from '@replays/infrastructure/acl/people.adapter';
import { SearchAgents } from '@replays/infrastructure/acl/search-agents.adapter';
import { SearchNotices } from '@replays/infrastructure/acl/search-notices.adapter';
import { Work } from '@replays/infrastructure/acl/work.adapter';
import { Sha256Hash } from '@replays/infrastructure/hashing/sha256-hash';
import { HclStationSourceEditor } from '@replays/infrastructure/hcl/station-source.editor';
import { DrizzleCandidateRepository } from '@replays/infrastructure/persistence/drizzle/repositories/candidate.repository';
import { DrizzleConfigPullRequestRepository } from '@replays/infrastructure/persistence/drizzle/repositories/config-pull-request.repository';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { DrizzleReplayCheckRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-check.repository';
import { DrizzleReplaySetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-set.repository';
import { DrizzleSearchRepository } from '@replays/infrastructure/persistence/drizzle/repositories/search.repository';
import { DrizzleStationSearchScheduleRepository } from '@replays/infrastructure/persistence/drizzle/repositories/station-search-schedule.repository';
import { replaysSubscribers } from '@replays/presentation/events/replays.subscribers';
import { ConfigPullRequestsController } from '@replays/presentation/http/controllers/config-pull-requests.controller';
import { ReplayCandidateResourceController } from '@replays/presentation/http/controllers/replay-candidate-resource.controller';
import { ReplayChecksController } from '@replays/presentation/http/controllers/replay-checks.controller';
import { ReplaySetsController } from '@replays/presentation/http/controllers/replay-sets.controller';
import { ReplayedCandidatesController } from '@replays/presentation/http/controllers/replayed-candidates.controller';
import { ReplaysController } from '@replays/presentation/http/controllers/replays.controller';
import { RunnerFailureCausesController } from '@replays/presentation/http/controllers/runner-failure-causes.controller';
import { RunnerSearchCandidatesController } from '@replays/presentation/http/controllers/runner-search-candidates.controller';
import { SearchesController } from '@replays/presentation/http/controllers/searches.controller';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
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
import { SEARCH_AGENTS } from '@work/application/ports/search-agents.port';
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

const REPLAYS_EVENTS = Symbol('REPLAYS_EVENTS');

const WEB_ORIGIN = Symbol('REPLAYS_WEB_ORIGIN');

export const REPLAYS_CONTROLLERS: readonly Type[] = [
  ReplayCandidateResourceController,
  ReplaySetsController,
  ReplaysController,
  SearchesController,
  ReplayChecksController,
  RunnerSearchCandidatesController,
  RunnerFailureCausesController,
  ConfigPullRequestsController,
  ReplayedCandidatesController,
];

export const REPLAYS_PROVIDERS: readonly Provider[] = [
  {
    provide: SEARCH_VISIBILITY,
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
  { provide: HASH, useClass: Sha256Hash },
  {
    provide: SEARCH_AGENTS,
    inject: [DrizzleSearchRepository],
    useFactory: (searches: DrizzleSearchRepository) =>
      new SearchAgents(searches),
  },
  DrizzleReplaySetRepository,
  DrizzleCandidateRepository,
  DrizzleReplayRepository,
  DrizzleSearchRepository,
  DrizzleReplayCheckRepository,
  DrizzleConfigPullRequestRepository,
  DrizzleStationSearchScheduleRepository,
  {
    provide: CONFIG_REPOSITORY,
    inject: [REPOSITORY_CONTENTS, PULL_REQUESTS],
    useFactory: (
      contents: RepositoryContentsPort,
      pullRequests: PullRequestPort,
    ) => new ConfigRepository(contents, pullRequests),
  },
  { provide: STATION_SOURCE_EDITOR, useClass: HclStationSourceEditor },
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
    inject: [RUN_ACCEPTANCE, CHANGE_JUDGING, SIDE_BY_SIDE_JUDGING],
    useFactory: (
      acceptance: RunAcceptancePort,
      judging: ChangeJudgingPort,
      pairs: SideBySideJudgingPort,
    ) => new Insights(acceptance, judging, pairs),
  },
  {
    provide: PEOPLE,
    inject: [WORKSPACE_ACCESS, TEAM_DIRECTORY, WORKSPACE_READER],
    useFactory: (
      access: WorkspaceAccessPort,
      teams: TeamDirectoryPort,
      workspaces: WorkspaceReaderPort,
    ) => new People(access, teams, workspaces),
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
  ...bindCommandHandler(
    RemoveReplaySetEntryCommand,
    RemoveReplaySetEntryHandler,
    [ReplaysAccess, DrizzleReplaySetRepository, SetUsage, TRANSACTION],
  ),
  ...bindCommandHandler(ProposeCandidateCommand, ProposeCandidateHandler, [
    PEOPLE,
    WORK,
    DrizzleCandidateRepository,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    CLOCK,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteCandidateCommand, DeleteCandidateHandler, [
    PEOPLE,
    DrizzleCandidateRepository,
    DrizzleReplayRepository,
    TRANSACTION,
  ]),
  ...bindQueryHandler(ReadCandidateQuery, ReadCandidateHandler, [
    PEOPLE,
    DrizzleCandidateRepository,
  ]),
  ...bindQueryHandler(ImportCandidateQuery, ImportCandidateHandler, [
    PEOPLE,
    DrizzleCandidateRepository,
  ]),
  ...bindQueryHandler(ListCandidatesQuery, ListCandidatesHandler, [
    PEOPLE,
    DrizzleCandidateRepository,
  ]),
  ...bindCommandHandler(StartReplayCommand, StartReplayHandler, [
    ReplaysAccess,
    LiveSnapshots,
    DrizzleCandidateRepository,
    DrizzleReplaySetRepository,
    DrizzleReplayRepository,
    ID_GENERATOR,
    CLOCK,
    TRANSACTION,
    SetStations,
    RefreshKeptSets,
  ]),
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
    LiveSnapshots,
    CheckEvaluations,
    DrizzleCandidateRepository,
    DrizzleReplaySetRepository,
    DrizzleReplayRepository,
    DrizzleReplayCheckRepository,
    IDEMPOTENT_CREATES,
    HASH,
    ID_GENERATOR,
    CLOCK,
    TRANSACTION,
  ]),
  {
    provide: WEB_ORIGIN,
    inject: [ENV],
    useFactory: (env: Env) => publicUrlOf(env),
  },
  ...bindQueryHandler(ListSetReplayChecksQuery, ListSetReplayChecksHandler, [
    ReplaysAccess,
    PEOPLE,
    DrizzleReplayCheckRepository,
    CheckEvaluations,
    WEB_ORIGIN,
  ]),
  ...bindQueryHandler(ReadReplayCheckQuery, ReadReplayCheckHandler, [
    ReplaysAccess,
    PEOPLE,
    WORK,
    DrizzleReplayCheckRepository,
    CheckEvaluations,
    WEB_ORIGIN,
  ]),
  {
    provide: DeleteReplayChecks,
    inject: [DrizzleReplayCheckRepository, TRANSACTION],
    useFactory: (
      checks: DrizzleReplayCheckRepository,
      transaction: TransactionPort,
    ) => new DeleteReplayChecks(checks, transaction),
  },
  ...bindCommandHandler(StopReplayCommand, StopReplayHandler, [
    ReplaysAccess,
    DrizzleReplayRepository,
    CLOCK,
  ]),
  ...bindCommandHandler(StopSearchCommand, StopSearchHandler, [
    ReplaysAccess,
    DrizzleSearchRepository,
    CLOCK,
    TRANSACTION,
  ]),
  ...bindCommandHandler(
    ProposeSearchCandidateCommand,
    ProposeSearchCandidateHandler,
    [
      PEOPLE,
      WORK,
      DrizzleSearchRepository,
      DrizzleCandidateRepository,
      DrizzleReplayRepository,
      DrizzleReplaySetRepository,
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
    provide: SearchSummaries,
    inject: [DrizzleReplayRepository, SetHealths],
    useFactory: (replays: DrizzleReplayRepository, healths: SetHealths) =>
      new SearchSummaries(replays, healths),
  },
  ...bindQueryHandler(ListSearchesQuery, ListSearchesHandler, [
    ReplaysAccess,
    DrizzleSearchRepository,
    SearchSummaries,
  ]),
  ...bindQueryHandler(ListTeamSearchesQuery, ListTeamSearchesHandler, [
    ReplaysAccess,
    DrizzleSearchRepository,
    SearchSummaries,
  ]),
  ...bindQueryHandler(ReadSearchQuery, ReadSearchHandler, [
    ReplaysAccess,
    DrizzleReplayRepository,
    DrizzleCandidateRepository,
    DrizzleConfigPullRequestRepository,
    SetHealths,
  ]),
  ...bindQueryHandler(
    ReadConfigPullRequestQuery,
    ReadConfigPullRequestHandler,
    [ReplaysAccess, DrizzleConfigPullRequestRepository],
  ),
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
      WEB_ORIGIN,
      SetHealths,
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
      origin: string,
      healths: SetHealths,
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
        origin,
        healths,
      ),
  },
  {
    provide: DeleteConfigPullRequests,
    inject: [DrizzleConfigPullRequestRepository, TRANSACTION],
    useFactory: (
      pullRequests: DrizzleConfigPullRequestRepository,
      transaction: TransactionPort,
    ) => new DeleteConfigPullRequests(pullRequests, transaction),
  },
  ...bindQueryHandler(ReadReplaySetQuery, ReadReplaySetHandler, [
    ReplaysAccess,
    DrizzleReplaySetRepository,
    WORK,
    INSIGHTS,
    SetHealths,
    DrizzleStationSearchScheduleRepository,
  ]),
  ...bindQueryHandler(ListTeamReplaySetsQuery, ListTeamReplaySetsHandler, [
    ReplaysAccess,
    DrizzleReplaySetRepository,
    WORK,
    INSIGHTS,
    SetHealths,
    DrizzleStationSearchScheduleRepository,
  ]),
  ...bindQueryHandler(ListReplaysQuery, ListReplaysHandler, [
    ReplaysAccess,
    DrizzleReplayRepository,
    DrizzleCandidateRepository,
    SetHealths,
  ]),
  ...bindQueryHandler(ReadReplayQuery, ReadReplayHandler, [
    ReplaysAccess,
    DrizzleReplayRepository,
    DrizzleCandidateRepository,
    WORK,
    SetHealths,
  ]),
  ...bindQueryHandler(
    ReadReplayedCandidatesQuery,
    ReadReplayedCandidatesHandler,
    [
      ReplaysAccess,
      DrizzleReplayRepository,
      DrizzleSearchRepository,
      DrizzleReplaySetRepository,
      DrizzleCandidateRepository,
      DrizzleConfigPullRequestRepository,
      WORK,
      CLOCK,
      SetHealths,
    ],
  ),
  ...bindQueryHandler(ReadReplayOfRunQuery, ReadReplayOfRunHandler, [
    ReplaysAccess,
    DrizzleReplayRepository,
    DrizzleCandidateRepository,
  ]),
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
      DrizzleCandidateRepository,
      DrizzleReplaySetRepository,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      SetHealths,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      sets: DrizzleReplaySetRepository,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
      healths: SetHealths,
    ) =>
      new HoldOutSearch(
        searches,
        replays,
        candidates,
        sets,
        ids,
        clock,
        transaction,
        healths,
      ),
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
      LiveSnapshots,
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
      snapshots: LiveSnapshots,
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
    provide: RefreshKeptSets,
    inject: [
      DrizzleReplaySetRepository,
      SetUsage,
      WORK,
      INSIGHTS,
      CLOCK,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      sets: DrizzleReplaySetRepository,
      usage: SetUsage,
      work: WorkPort,
      insights: InsightsPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new RefreshKeptSets(
        sets,
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
      LiveSnapshots,
      DrizzleReplaySetRepository,
      DrizzleReplayRepository,
      DrizzleSearchRepository,
      DrizzleStationSearchScheduleRepository,
      HASH,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      snapshots: LiveSnapshots,
      sets: DrizzleReplaySetRepository,
      replays: DrizzleReplayRepository,
      searches: DrizzleSearchRepository,
      schedules: DrizzleStationSearchScheduleRepository,
      hash: HashPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new StartSearch(
        snapshots,
        sets,
        replays,
        searches,
        schedules,
        hash,
        ids,
        clock,
        transaction,
      ),
  },
  {
    provide: AutoSearches,
    inject: [
      DrizzleStationSearchScheduleRepository,
      DrizzleReplaySetRepository,
      DrizzleSearchRepository,
      DrizzleConfigPullRequestRepository,
      RefreshKeptSets,
      SetHealths,
      StartSearch,
      WORK,
      HASH,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      schedules: DrizzleStationSearchScheduleRepository,
      sets: DrizzleReplaySetRepository,
      searches: DrizzleSearchRepository,
      pullRequests: DrizzleConfigPullRequestRepository,
      refreshing: RefreshKeptSets,
      healths: SetHealths,
      starting: StartSearch,
      work: WorkPort,
      hash: HashPort,
      ids: IdGeneratorPort,
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
        healths,
        starting,
        work,
        hash,
        ids,
        clock,
        transaction,
        logger,
      ),
  },
  {
    provide: SearchSchedules,
    inject: [DrizzleStationSearchScheduleRepository, TRANSACTION, CLOCK],
    useFactory: (
      schedules: DrizzleStationSearchScheduleRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new SearchSchedules(schedules, transaction, clock),
  },
  {
    provide: PickSearchCandidates,
    inject: [
      DrizzleSearchRepository,
      DrizzleReplayRepository,
      DrizzleConfigPullRequestRepository,
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
        healths,
        work,
        ids,
        clock,
        transaction,
      ),
  },
  {
    provide: NoticeSearchResults,
    inject: [
      DrizzleSearchRepository,
      DrizzleConfigPullRequestRepository,
      WORK,
      SEARCH_NOTICES,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      pullRequests: DrizzleConfigPullRequestRepository,
      work: WorkPort,
      notices: SearchNoticesPort,
    ) => new NoticeSearchResults(searches, pullRequests, work, notices),
  },
  {
    provide: PendingJobWorker,
    inject: [
      DispatchReplayRuns,
      AdvanceSearches,
      OpenConfigPullRequests,
      EnsureCheckBaselines,
      RefreshKeptSets,
      AutoSearches,
      LOGGER,
    ],
    useFactory: (
      dispatching: DispatchReplayRuns,
      advancing: AdvanceSearches,
      opening: OpenConfigPullRequests,
      baselines: EnsureCheckBaselines,
      refreshing: RefreshKeptSets,
      searching: AutoSearches,
      logger: LoggerPort,
    ) =>
      new PendingJobWorker(
        [dispatching, advancing, opening, baselines, refreshing, searching],
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
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      insights: InsightsPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new RequestReplayJudging(
        replays,
        candidates,
        insights,
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
    inject: [DrizzleReplayRepository, DrizzleCandidateRepository, INSIGHTS],
    useFactory: (
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      insights: InsightsPort,
    ) => new RequestReplaySideBySideJudging(replays, candidates, insights),
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
    inject: [INSIGHTS],
    useFactory: (insights: InsightsPort) =>
      new RequestReplayRejudging(insights),
  },
  {
    provide: RequestReplayRecheck,
    inject: [CHANGE_REVIEW],
    useFactory: (changes: ChangeReviewPort) =>
      new RequestReplayRecheck(changes),
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
    provide: LiveSnapshots,
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
      new LiveSnapshots(
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
      IntegrationEventMappers,
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
      NoticeSearchResults,
      PickSearchCandidates,
      SearchSchedules,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
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
      noticingResults: NoticeSearchResults,
      picking: PickSearchCandidates,
      schedules: SearchSchedules,
    ) => {
      types.register('replays', REPLAYS_PAYLOAD_TYPES);
      mappers.register(REPLAYS_EVENT_MAPPERS);
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
          noticingResults,
          picking,
          schedules,
        }),
      );
      return true;
    },
  },
];
