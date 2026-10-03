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
import type { Provider, Type } from '@nestjs/common';
import {
  CHANGE_JUDGING,
  type ChangeJudgingPort,
} from '@outcomes/application/ports/change-judging.port';
import {
  RUN_ACCEPTANCE,
  type RunAcceptancePort,
} from '@outcomes/application/ports/run-acceptance.port';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { OwedWorkWorker } from '@platform/workers/owed-work.worker';
import { AddReplaySetEntryCommand } from '@replays/application/commands/add-replay-set-entry.command';
import { DeleteReplaySetCommand } from '@replays/application/commands/delete-replay-set.command';
import { GuardChangesCommand } from '@replays/application/commands/guard-changes.command';
import { AddReplaySetEntryHandler } from '@replays/application/commands/handlers/add-replay-set-entry.handler';
import { DeleteReplaySetHandler } from '@replays/application/commands/handlers/delete-replay-set.handler';
import { GuardChangesHandler } from '@replays/application/commands/handlers/guard-changes.handler';
import { OpenReplaySetHandler } from '@replays/application/commands/handlers/open-replay-set.handler';
import { PickSearchCandidateHandler } from '@replays/application/commands/handlers/pick-search-candidate.handler';
import { ProposeCandidateHandler } from '@replays/application/commands/handlers/propose-candidate.handler';
import { ProposeSearchCandidateHandler } from '@replays/application/commands/handlers/propose-search-candidate.handler';
import { RemoveReplaySetEntryHandler } from '@replays/application/commands/handlers/remove-replay-set-entry.handler';
import { RenameReplaySetHandler } from '@replays/application/commands/handlers/rename-replay-set.handler';
import { StartReplayHandler } from '@replays/application/commands/handlers/start-replay.handler';
import { StartReplayCheckHandler } from '@replays/application/commands/handlers/start-replay-check.handler';
import { StartSearchHandler } from '@replays/application/commands/handlers/start-search.handler';
import { StopReplayHandler } from '@replays/application/commands/handlers/stop-replay.handler';
import { StopSearchHandler } from '@replays/application/commands/handlers/stop-search.handler';
import { WithdrawCandidateHandler } from '@replays/application/commands/handlers/withdraw-candidate.handler';
import { OpenReplaySetCommand } from '@replays/application/commands/open-replay-set.command';
import { PickSearchCandidateCommand } from '@replays/application/commands/pick-search-candidate.command';
import { ProposeCandidateCommand } from '@replays/application/commands/propose-candidate.command';
import { ProposeSearchCandidateCommand } from '@replays/application/commands/propose-search-candidate.command';
import { RemoveReplaySetEntryCommand } from '@replays/application/commands/remove-replay-set-entry.command';
import { RenameReplaySetCommand } from '@replays/application/commands/rename-replay-set.command';
import { StartReplayCommand } from '@replays/application/commands/start-replay.command';
import { StartReplayCheckCommand } from '@replays/application/commands/start-replay-check.command';
import { StartSearchCommand } from '@replays/application/commands/start-search.command';
import { StopReplayCommand } from '@replays/application/commands/stop-replay.command';
import { StopSearchCommand } from '@replays/application/commands/stop-search.command';
import { WithdrawCandidateCommand } from '@replays/application/commands/withdraw-candidate.command';
import {
  CHANGE_REVIEW,
  type ChangeReviewPort,
} from '@replays/application/ports/change-review.port';
import {
  CONFIG_REPOSITORY,
  type ConfigRepositoryPort,
} from '@replays/application/ports/config-repository.port';
import { DIGEST } from '@replays/application/ports/digest.port';
import {
  OUTCOMES,
  type OutcomesPort,
} from '@replays/application/ports/outcomes.port';
import {
  PEOPLE,
  type PeoplePort,
} from '@replays/application/ports/people.port';
import {
  STATION_SOURCE_EDITOR,
  type StationSourceEditorPort,
} from '@replays/application/ports/station-source-editor.port';
import { WORK, type WorkPort } from '@replays/application/ports/work.port';
import { EstimateSearchQuery } from '@replays/application/queries/estimate-search.query';
import { EstimateSearchHandler } from '@replays/application/queries/handlers/estimate-search.handler';
import { ImportCandidateHandler } from '@replays/application/queries/handlers/import-candidate.handler';
import { ListCandidatesHandler } from '@replays/application/queries/handlers/list-candidates.handler';
import { ListReplaySetsHandler } from '@replays/application/queries/handlers/list-replay-sets.handler';
import { ListReplayableRunsHandler } from '@replays/application/queries/handlers/list-replayable-runs.handler';
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
import { ReadReplayedCandidatesHandler } from '@replays/application/queries/handlers/read-replayed-candidates.handler';
import { ReadSearchHandler } from '@replays/application/queries/handlers/read-search.handler';
import { ImportCandidateQuery } from '@replays/application/queries/import-candidate.query';
import { ListCandidatesQuery } from '@replays/application/queries/list-candidates.query';
import { ListReplaySetsQuery } from '@replays/application/queries/list-replay-sets.query';
import { ListReplayableRunsQuery } from '@replays/application/queries/list-replayable-runs.query';
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
import { ReadReplayedCandidatesQuery } from '@replays/application/queries/read-replayed-candidates.query';
import { ReadSearchQuery } from '@replays/application/queries/read-search.query';
import { AbandonConfigPullRequests } from '@replays/application/services/abandon-config-pull-requests.service';
import { AbandonReplayChecks } from '@replays/application/services/abandon-replay-checks.service';
import { AbandonReplays } from '@replays/application/services/abandon-replays.service';
import { AbandonSearches } from '@replays/application/services/abandon-searches.service';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { AskForReplayJudging } from '@replays/application/services/ask-for-replay-judging.service';
import { CheckReadings } from '@replays/application/services/check-readings.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { DispatchSearchIteration } from '@replays/application/services/dispatch-search-iteration.service';
import { EnsureCheckBaselines } from '@replays/application/services/ensure-check-baselines.service';
import { HoldOutSearch } from '@replays/application/services/hold-out-search.service';
import { HoldSetStartingPoints } from '@replays/application/services/hold-set-starting-points.service';
import { LetReplayRunsGo } from '@replays/application/services/let-replay-runs-go.service';
import { LetSearchGo } from '@replays/application/services/let-search-go.service';
import { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import { NoteLineRedefined } from '@replays/application/services/note-line-redefined.service';
import { NoteReplayChangeReviewed } from '@replays/application/services/note-replay-change-reviewed.service';
import { NoteReplayDigested } from '@replays/application/services/note-replay-digested.service';
import { NoteReplayEnded } from '@replays/application/services/note-replay-ended.service';
import { NoteReplayJudged } from '@replays/application/services/note-replay-judged.service';
import { NoteSearchProgress } from '@replays/application/services/note-search-progress.service';
import { OpenConfigPullRequests } from '@replays/application/services/open-config-pull-requests.service';
import { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { SearchSights } from '@replays/application/services/search-sights.service';
import { SearchSummaries } from '@replays/application/services/search-summaries.service';
import { SetStations } from '@replays/application/services/set-stations.service';
import { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import { REPLAYS_EVENT_TYPES } from '@replays/domain/event-types';
import { ChangeReview } from '@replays/infrastructure/acl/change-review.adapter';
import { ConfigRepository } from '@replays/infrastructure/acl/config-repository.adapter';
import { Outcomes } from '@replays/infrastructure/acl/outcomes.adapter';
import { People } from '@replays/infrastructure/acl/people.adapter';
import { SearchAgents } from '@replays/infrastructure/acl/search-agents.adapter';
import { Work } from '@replays/infrastructure/acl/work.adapter';
import { Sha256Digest } from '@replays/infrastructure/hashing/sha256-digest';
import { HclStationSourceEditor } from '@replays/infrastructure/hcl/station-source.editor';
import { DrizzleCandidateRepository } from '@replays/infrastructure/persistence/drizzle/repositories/candidate.repository';
import { DrizzleConfigPullRequestRepository } from '@replays/infrastructure/persistence/drizzle/repositories/config-pull-request.repository';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { DrizzleReplayCheckRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-check.repository';
import { DrizzleReplaySetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-set.repository';
import { DrizzleSearchRepository } from '@replays/infrastructure/persistence/drizzle/repositories/search.repository';
import { replaysSubscribers } from '@replays/presentation/events/replays.subscribers';
import { ConfigPullRequestsController } from '@replays/presentation/http/controllers/config-pull-requests.controller';
import { ReplayCandidateResourceController } from '@replays/presentation/http/controllers/replay-candidate-resource.controller';
import { ReplayChecksController } from '@replays/presentation/http/controllers/replay-checks.controller';
import { ReplaySetsController } from '@replays/presentation/http/controllers/replay-sets.controller';
import { ReplayedCandidatesController } from '@replays/presentation/http/controllers/replayed-candidates.controller';
import { ReplaysController } from '@replays/presentation/http/controllers/replays.controller';
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
import { SEARCH_SIGHT } from '@work/application/ports/search-sight.port';
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
  ConfigPullRequestsController,
  ReplayedCandidatesController,
];

export const REPLAYS_PROVIDERS: readonly Provider[] = [
  {
    provide: SEARCH_SIGHT,
    inject: [
      DrizzleSearchRepository,
      DrizzleCandidateRepository,
      DrizzleReplayRepository,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      candidates: DrizzleCandidateRepository,
      replays: DrizzleReplayRepository,
    ) => new SearchSights(searches, candidates, replays),
  },
  { provide: DIGEST, useClass: Sha256Digest },
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
      holds: StartingPointHoldsPort,
      searching: SearchDispatchPort,
      searchRuns: SearchRunsPort,
    ) => new Work(runs, candidates, dispatching, holds, searching, searchRuns),
  },
  {
    provide: CHANGE_REVIEW,
    inject: [RUN_CHANGE_CHECKS],
    useFactory: (checks: RunChangeChecksPort) => new ChangeReview(checks),
  },
  {
    provide: OUTCOMES,
    inject: [RUN_ACCEPTANCE, CHANGE_JUDGING],
    useFactory: (acceptance: RunAcceptancePort, judging: ChangeJudgingPort) =>
      new Outcomes(acceptance, judging),
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
  ...bindCommandHandler(OpenReplaySetCommand, OpenReplaySetHandler, [
    ReplaysAccess,
    DrizzleReplaySetRepository,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(RenameReplaySetCommand, RenameReplaySetHandler, [
    ReplaysAccess,
    DrizzleReplaySetRepository,
  ]),
  ...bindCommandHandler(DeleteReplaySetCommand, DeleteReplaySetHandler, [
    ReplaysAccess,
    DrizzleReplaySetRepository,
    DrizzleReplayRepository,
    DrizzleSearchRepository,
    TRANSACTION,
  ]),
  ...bindCommandHandler(AddReplaySetEntryCommand, AddReplaySetEntryHandler, [
    ReplaysAccess,
    DrizzleReplaySetRepository,
    DrizzleSearchRepository,
    WORK,
    CLOCK,
    SetStations,
    TRANSACTION,
  ]),
  ...bindCommandHandler(
    RemoveReplaySetEntryCommand,
    RemoveReplaySetEntryHandler,
    [
      ReplaysAccess,
      DrizzleReplaySetRepository,
      DrizzleSearchRepository,
      TRANSACTION,
    ],
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
  ...bindCommandHandler(WithdrawCandidateCommand, WithdrawCandidateHandler, [
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
  ]),
  ...bindCommandHandler(GuardChangesCommand, GuardChangesHandler, [
    ReplaysAccess,
    DrizzleReplaySetRepository,
    TRANSACTION,
  ]),
  {
    provide: CheckReadings,
    inject: [DrizzleReplayRepository, DrizzleReplaySetRepository],
    useFactory: (
      replays: DrizzleReplayRepository,
      sets: DrizzleReplaySetRepository,
    ) => new CheckReadings(replays, sets),
  },
  ...bindCommandHandler(StartReplayCheckCommand, StartReplayCheckHandler, [
    ReplaysAccess,
    PEOPLE,
    WORK,
    LiveSnapshots,
    CheckReadings,
    DrizzleCandidateRepository,
    DrizzleReplaySetRepository,
    DrizzleReplayRepository,
    DrizzleReplayCheckRepository,
    IDEMPOTENT_CREATES,
    DIGEST,
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
    CheckReadings,
    WEB_ORIGIN,
  ]),
  ...bindQueryHandler(ReadReplayCheckQuery, ReadReplayCheckHandler, [
    ReplaysAccess,
    PEOPLE,
    WORK,
    DrizzleReplayCheckRepository,
    CheckReadings,
    WEB_ORIGIN,
  ]),
  {
    provide: AbandonReplayChecks,
    inject: [DrizzleReplayCheckRepository, TRANSACTION],
    useFactory: (
      checks: DrizzleReplayCheckRepository,
      transaction: TransactionPort,
    ) => new AbandonReplayChecks(checks, transaction),
  },
  ...bindCommandHandler(StopReplayCommand, StopReplayHandler, [
    ReplaysAccess,
    DrizzleReplayRepository,
    CLOCK,
  ]),
  ...bindCommandHandler(StartSearchCommand, StartSearchHandler, [
    ReplaysAccess,
    WORK,
    LiveSnapshots,
    DrizzleReplaySetRepository,
    DrizzleReplayRepository,
    DrizzleSearchRepository,
    DIGEST,
    ID_GENERATOR,
    CLOCK,
    TRANSACTION,
    SetStations,
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
  {
    provide: SearchSummaries,
    inject: [DrizzleReplayRepository],
    useFactory: (replays: DrizzleReplayRepository) =>
      new SearchSummaries(replays),
  },
  ...bindQueryHandler(EstimateSearchQuery, EstimateSearchHandler, [
    ReplaysAccess,
    WORK,
  ]),
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
  ]),
  ...bindCommandHandler(
    PickSearchCandidateCommand,
    PickSearchCandidateHandler,
    [
      ReplaysAccess,
      WORK,
      DrizzleConfigPullRequestRepository,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
  ),
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
      ),
  },
  {
    provide: AbandonConfigPullRequests,
    inject: [DrizzleConfigPullRequestRepository, TRANSACTION],
    useFactory: (
      pullRequests: DrizzleConfigPullRequestRepository,
      transaction: TransactionPort,
    ) => new AbandonConfigPullRequests(pullRequests, transaction),
  },
  ...bindQueryHandler(ListReplaySetsQuery, ListReplaySetsHandler, [
    ReplaysAccess,
    DrizzleReplaySetRepository,
    WORK,
  ]),
  ...bindQueryHandler(ListTeamReplaySetsQuery, ListTeamReplaySetsHandler, [
    ReplaysAccess,
    DrizzleReplaySetRepository,
    WORK,
  ]),
  ...bindQueryHandler(ListReplayableRunsQuery, ListReplayableRunsHandler, [
    ReplaysAccess,
    WORK,
  ]),
  ...bindQueryHandler(ListReplaysQuery, ListReplaysHandler, [
    ReplaysAccess,
    DrizzleReplayRepository,
    DrizzleCandidateRepository,
  ]),
  ...bindQueryHandler(ReadReplayQuery, ReadReplayHandler, [
    ReplaysAccess,
    DrizzleReplayRepository,
    DrizzleCandidateRepository,
    WORK,
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
    ],
  ),
  ...bindQueryHandler(ReadReplayOfRunQuery, ReadReplayOfRunHandler, [
    ReplaysAccess,
    DrizzleReplayRepository,
    DrizzleReplaySetRepository,
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
    provide: NoteSearchProgress,
    inject: [
      DrizzleSearchRepository,
      DrizzleReplayRepository,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      replays: DrizzleReplayRepository,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => new NoteSearchProgress(searches, replays, ids, clock, transaction),
  },
  {
    provide: DispatchSearchIteration,
    inject: [
      DrizzleSearchRepository,
      DrizzleCandidateRepository,
      WORK,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      candidates: DrizzleCandidateRepository,
      work: WorkPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new DispatchSearchIteration(
        searches,
        candidates,
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
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      sets: DrizzleReplaySetRepository,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new HoldOutSearch(
        searches,
        replays,
        candidates,
        sets,
        ids,
        clock,
        transaction,
      ),
  },
  {
    provide: LetSearchGo,
    inject: [DrizzleReplayRepository, WORK, CLOCK, TRANSACTION],
    useFactory: (
      replays: DrizzleReplayRepository,
      work: WorkPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => new LetSearchGo(replays, work, clock, transaction),
  },
  {
    provide: AbandonSearches,
    inject: [DrizzleSearchRepository, WORK, CLOCK, TRANSACTION],
    useFactory: (
      searches: DrizzleSearchRepository,
      work: WorkPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => new AbandonSearches(searches, work, clock, transaction),
  },
  {
    provide: AdvanceSearches,
    inject: [
      DrizzleSearchRepository,
      DrizzleReplayRepository,
      WORK,
      DispatchSearchIteration,
      HoldOutSearch,
      NoteSearchProgress,
      LetSearchGo,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      searches: DrizzleSearchRepository,
      replays: DrizzleReplayRepository,
      work: WorkPort,
      dispatching: DispatchSearchIteration,
      holding: HoldOutSearch,
      noting: NoteSearchProgress,
      lettingGo: LetSearchGo,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new AdvanceSearches(
        searches,
        replays,
        work,
        dispatching,
        holding,
        noting,
        lettingGo,
        clock,
        logger,
      ),
  },
  {
    provide: EnsureCheckBaselines,
    inject: [
      DrizzleReplayCheckRepository,
      CheckReadings,
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
      readings: CheckReadings,
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
        readings,
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
    provide: OwedWorkWorker,
    inject: [
      DispatchReplayRuns,
      AdvanceSearches,
      OpenConfigPullRequests,
      EnsureCheckBaselines,
      LOGGER,
    ],
    useFactory: (
      dispatching: DispatchReplayRuns,
      advancing: AdvanceSearches,
      opening: OpenConfigPullRequests,
      baselines: EnsureCheckBaselines,
      logger: LoggerPort,
    ) =>
      new OwedWorkWorker([dispatching, advancing, opening, baselines], logger),
  },
  {
    provide: NoteReplayEnded,
    inject: [DrizzleReplayRepository, CHANGE_REVIEW, TRANSACTION, CLOCK],
    useFactory: (
      replays: DrizzleReplayRepository,
      changes: ChangeReviewPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new NoteReplayEnded(replays, changes, transaction, clock),
  },
  {
    provide: NoteReplayChangeReviewed,
    inject: [DrizzleReplayRepository, CHANGE_REVIEW, TRANSACTION, CLOCK],
    useFactory: (
      replays: DrizzleReplayRepository,
      changes: ChangeReviewPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new NoteReplayChangeReviewed(replays, changes, transaction, clock),
  },
  {
    provide: AskForReplayJudging,
    inject: [
      DrizzleReplayRepository,
      DrizzleCandidateRepository,
      OUTCOMES,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      outcomes: OutcomesPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new AskForReplayJudging(
        replays,
        candidates,
        outcomes,
        transaction,
        clock,
      ),
  },
  {
    provide: NoteReplayJudged,
    inject: [DrizzleReplayRepository, TRANSACTION, CLOCK],
    useFactory: (
      replays: DrizzleReplayRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new NoteReplayJudged(replays, transaction, clock),
  },
  {
    provide: NoteReplayDigested,
    inject: [DrizzleReplayRepository, TRANSACTION, CLOCK],
    useFactory: (
      replays: DrizzleReplayRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new NoteReplayDigested(replays, transaction, clock),
  },
  {
    provide: HoldSetStartingPoints,
    inject: [DrizzleReplaySetRepository, WORK],
    useFactory: (sets: DrizzleReplaySetRepository, work: WorkPort) =>
      new HoldSetStartingPoints(sets, work),
  },
  {
    provide: LetReplayRunsGo,
    inject: [WORK],
    useFactory: (work: WorkPort) => new LetReplayRunsGo(work),
  },
  {
    provide: AbandonReplays,
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
    ) => new AbandonReplays(sets, replays, candidates, transaction),
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
    provide: NoteLineRedefined,
    inject: [DrizzleReplaySetRepository, WORK, TRANSACTION, CLOCK],
    useFactory: (
      sets: DrizzleReplaySetRepository,
      work: WorkPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new NoteLineRedefined(sets, work, transaction, clock),
  },
  {
    provide: REPLAYS_EVENTS,
    inject: [
      EventTypes,
      EventSubscribers,
      NoteReplayEnded,
      NoteReplayDigested,
      NoteReplayChangeReviewed,
      AskForReplayJudging,
      NoteReplayJudged,
      HoldSetStartingPoints,
      LetReplayRunsGo,
      AbandonReplays,
      NoteLineRedefined,
      StartWantedBaseline,
      NoteSearchProgress,
      DispatchSearchIteration,
      HoldOutSearch,
      LetSearchGo,
      AbandonSearches,
      AbandonReplayChecks,
      AbandonConfigPullRequests,
    ],
    useFactory: (
      types: EventTypes,
      subscribers: EventSubscribers,
      ending: NoteReplayEnded,
      digesting: NoteReplayDigested,
      reviewing: NoteReplayChangeReviewed,
      asking: AskForReplayJudging,
      judging: NoteReplayJudged,
      holding: HoldSetStartingPoints,
      lettingGo: LetReplayRunsGo,
      abandoning: AbandonReplays,
      redefining: NoteLineRedefined,
      baselines: StartWantedBaseline,
      searching: NoteSearchProgress,
      iterating: DispatchSearchIteration,
      holdingOut: HoldOutSearch,
      lettingSearchesGo: LetSearchGo,
      abandoningSearches: AbandonSearches,
      abandoningChecks: AbandonReplayChecks,
      abandoningPullRequests: AbandonConfigPullRequests,
    ) => {
      types.register('replays', REPLAYS_EVENT_TYPES);
      subscribers.register(
        replaysSubscribers({
          ending,
          digesting,
          reviewing,
          asking,
          judging,
          holding,
          lettingGo,
          abandoning,
          redefining,
          baselines,
          searching,
          iterating,
          holdingOut,
          lettingSearchesGo,
          abandoningSearches,
          abandoningChecks,
          abandoningPullRequests,
        }),
      );
      return true;
    },
  },
];
