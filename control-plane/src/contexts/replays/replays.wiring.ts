import {
  RUN_CHANGE_CHECKS,
  type RunChangeChecksPort,
} from '@change-review/application/ports/run-change-checks.port';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { Provider, Type } from '@nestjs/common';
import {
  CHANGE_JUDGING,
  type ChangeJudgingPort,
} from '@outcomes/application/ports/change-judging.port';
import {
  RUN_ACCEPTANCE,
  type RunAcceptancePort,
} from '@outcomes/application/ports/run-acceptance.port';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { OwedWorkWorker } from '@platform/workers/owed-work.worker';
import { AddReplaySetEntryCommand } from '@replays/application/commands/add-replay-set-entry.command';
import { DeleteReplaySetCommand } from '@replays/application/commands/delete-replay-set.command';
import { AddReplaySetEntryHandler } from '@replays/application/commands/handlers/add-replay-set-entry.handler';
import { DeleteReplaySetHandler } from '@replays/application/commands/handlers/delete-replay-set.handler';
import { OpenReplaySetHandler } from '@replays/application/commands/handlers/open-replay-set.handler';
import { ProposeCandidateHandler } from '@replays/application/commands/handlers/propose-candidate.handler';
import { RemoveReplaySetEntryHandler } from '@replays/application/commands/handlers/remove-replay-set-entry.handler';
import { RenameReplaySetHandler } from '@replays/application/commands/handlers/rename-replay-set.handler';
import { StartReplayHandler } from '@replays/application/commands/handlers/start-replay.handler';
import { StopReplayHandler } from '@replays/application/commands/handlers/stop-replay.handler';
import { WithdrawCandidateHandler } from '@replays/application/commands/handlers/withdraw-candidate.handler';
import { OpenReplaySetCommand } from '@replays/application/commands/open-replay-set.command';
import { ProposeCandidateCommand } from '@replays/application/commands/propose-candidate.command';
import { RemoveReplaySetEntryCommand } from '@replays/application/commands/remove-replay-set-entry.command';
import { RenameReplaySetCommand } from '@replays/application/commands/rename-replay-set.command';
import { StartReplayCommand } from '@replays/application/commands/start-replay.command';
import { StopReplayCommand } from '@replays/application/commands/stop-replay.command';
import { WithdrawCandidateCommand } from '@replays/application/commands/withdraw-candidate.command';
import {
  CHANGE_REVIEW,
  type ChangeReviewPort,
} from '@replays/application/ports/change-review.port';
import {
  OUTCOMES,
  type OutcomesPort,
} from '@replays/application/ports/outcomes.port';
import {
  PEOPLE,
  type PeoplePort,
} from '@replays/application/ports/people.port';
import { WORK, type WorkPort } from '@replays/application/ports/work.port';
import { ImportCandidateHandler } from '@replays/application/queries/handlers/import-candidate.handler';
import { ListCandidatesHandler } from '@replays/application/queries/handlers/list-candidates.handler';
import { ListReplaySetsHandler } from '@replays/application/queries/handlers/list-replay-sets.handler';
import { ListReplayableRunsHandler } from '@replays/application/queries/handlers/list-replayable-runs.handler';
import { ListReplaysHandler } from '@replays/application/queries/handlers/list-replays.handler';
import { ListTeamReplaySetsHandler } from '@replays/application/queries/handlers/list-team-replay-sets.handler';
import { ReadCandidateHandler } from '@replays/application/queries/handlers/read-candidate.handler';
import { ReadReplayHandler } from '@replays/application/queries/handlers/read-replay.handler';
import { ReadReplayOfRunHandler } from '@replays/application/queries/handlers/read-replay-of-run.handler';
import { ImportCandidateQuery } from '@replays/application/queries/import-candidate.query';
import { ListCandidatesQuery } from '@replays/application/queries/list-candidates.query';
import { ListReplaySetsQuery } from '@replays/application/queries/list-replay-sets.query';
import { ListReplayableRunsQuery } from '@replays/application/queries/list-replayable-runs.query';
import { ListReplaysQuery } from '@replays/application/queries/list-replays.query';
import { ListTeamReplaySetsQuery } from '@replays/application/queries/list-team-replay-sets.query';
import { ReadCandidateQuery } from '@replays/application/queries/read-candidate.query';
import { ReadReplayQuery } from '@replays/application/queries/read-replay.query';
import { ReadReplayOfRunQuery } from '@replays/application/queries/read-replay-of-run.query';
import { AbandonReplays } from '@replays/application/services/abandon-replays.service';
import { AskForReplayJudging } from '@replays/application/services/ask-for-replay-judging.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { HoldSetStartingPoints } from '@replays/application/services/hold-set-starting-points.service';
import { LetReplayRunsGo } from '@replays/application/services/let-replay-runs-go.service';
import { NoteLineRedefined } from '@replays/application/services/note-line-redefined.service';
import { NoteReplayChangeReviewed } from '@replays/application/services/note-replay-change-reviewed.service';
import { NoteReplayDigested } from '@replays/application/services/note-replay-digested.service';
import { NoteReplayEnded } from '@replays/application/services/note-replay-ended.service';
import { NoteReplayJudged } from '@replays/application/services/note-replay-judged.service';
import { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { SetStations } from '@replays/application/services/set-stations.service';
import { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import { REPLAYS_EVENT_TYPES } from '@replays/domain/event-types';
import { ChangeReview } from '@replays/infrastructure/acl/change-review.adapter';
import { Outcomes } from '@replays/infrastructure/acl/outcomes.adapter';
import { People } from '@replays/infrastructure/acl/people.adapter';
import { Work } from '@replays/infrastructure/acl/work.adapter';
import { DrizzleCandidateRepository } from '@replays/infrastructure/persistence/drizzle/repositories/candidate.repository';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { DrizzleReplaySetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-set.repository';
import { replaysSubscribers } from '@replays/presentation/events/replays.subscribers';
import { ReplayCandidateResourceController } from '@replays/presentation/http/controllers/replay-candidate-resource.controller';
import { ReplaySetsController } from '@replays/presentation/http/controllers/replay-sets.controller';
import { ReplaysController } from '@replays/presentation/http/controllers/replays.controller';
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
import {
  STARTING_POINT_HOLDS,
  type StartingPointHoldsPort,
} from '@work/application/ports/starting-point-holds.port';

const REPLAYS_EVENTS = Symbol('REPLAYS_EVENTS');

export const REPLAYS_CONTROLLERS: readonly Type[] = [
  ReplayCandidateResourceController,
  ReplaySetsController,
  ReplaysController,
];

export const REPLAYS_PROVIDERS: readonly Provider[] = [
  DrizzleReplaySetRepository,
  DrizzleCandidateRepository,
  DrizzleReplayRepository,
  {
    provide: WORK,
    inject: [
      REPLAYABLE_RUNS,
      REPLAY_CANDIDATES,
      REPLAY_DISPATCH,
      STARTING_POINT_HOLDS,
    ],
    useFactory: (
      runs: ReplayableRunsPort,
      candidates: ReplayCandidatesPort,
      dispatching: ReplayDispatchPort,
      holds: StartingPointHoldsPort,
    ) => new Work(runs, candidates, dispatching, holds),
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
    inject: [WORKSPACE_ACCESS, TEAM_DIRECTORY],
    useFactory: (access: WorkspaceAccessPort, teams: TeamDirectoryPort) =>
      new People(access, teams),
  },
  {
    provide: ReplaysAccess,
    inject: [PEOPLE, WORK, DrizzleReplaySetRepository, DrizzleReplayRepository],
    useFactory: (
      people: PeoplePort,
      work: WorkPort,
      sets: DrizzleReplaySetRepository,
      replays: DrizzleReplayRepository,
    ) => new ReplaysAccess(people, work, sets, replays),
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
    TRANSACTION,
  ]),
  ...bindCommandHandler(AddReplaySetEntryCommand, AddReplaySetEntryHandler, [
    ReplaysAccess,
    DrizzleReplaySetRepository,
    WORK,
    CLOCK,
    SetStations,
  ]),
  ...bindCommandHandler(
    RemoveReplaySetEntryCommand,
    RemoveReplaySetEntryHandler,
    [ReplaysAccess, DrizzleReplaySetRepository],
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
    PEOPLE,
    WORK,
    DrizzleCandidateRepository,
    DrizzleReplaySetRepository,
    DrizzleReplayRepository,
    ID_GENERATOR,
    CLOCK,
    TRANSACTION,
    SetStations,
    LOGGER,
  ]),
  ...bindCommandHandler(StopReplayCommand, StopReplayHandler, [
    ReplaysAccess,
    DrizzleReplayRepository,
    CLOCK,
  ]),
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
      WORK,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      replays: DrizzleReplayRepository,
      candidates: DrizzleCandidateRepository,
      work: WorkPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new DispatchReplayRuns(
        replays,
        candidates,
        work,
        ids,
        clock,
        transaction,
        logger,
      ),
  },
  {
    provide: OwedWorkWorker,
    inject: [DispatchReplayRuns, LOGGER],
    useFactory: (dispatching: DispatchReplayRuns, logger: LoggerPort) =>
      new OwedWorkWorker([dispatching], logger),
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
        }),
      );
      return true;
    },
  },
];
