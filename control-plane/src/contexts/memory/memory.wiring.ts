import {
  REPOSITORY_CONTENTS,
  type RepositoryContentsPort,
} from '@github/application/ports/repository-contents.port';
import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import {
  LINES as LINES_VIEW,
  type LinesPort as LinesViewPort,
} from '@lines/application/ports/lines.port';
import { ApproveMemoriesCommand } from '@memory/application/commands/approve-memories.command';
import { DecideUpkeepProposalCommand } from '@memory/application/commands/decide-upkeep-proposal.command';
import { EditMemoryCommand } from '@memory/application/commands/edit-memory.command';
import { ForgetCommand } from '@memory/application/commands/forget.command';
import { ApproveMemoriesHandler } from '@memory/application/commands/handlers/approve-memories.handler';
import { DecideUpkeepProposalHandler } from '@memory/application/commands/handlers/decide-upkeep-proposal.handler';
import { EditMemoryHandler } from '@memory/application/commands/handlers/edit-memory.handler';
import { ForgetHandler } from '@memory/application/commands/handlers/forget.handler';
import { RecordDeliveryHandler } from '@memory/application/commands/handlers/record-delivery.handler';
import { RecordRecallHandler } from '@memory/application/commands/handlers/record-recall.handler';
import { RejectMemoryHandler } from '@memory/application/commands/handlers/reject-memory.handler';
import { RememberHandler } from '@memory/application/commands/handlers/remember.handler';
import { RestoreMemoryHandler } from '@memory/application/commands/handlers/restore-memory.handler';
import { RetireMemoryHandler } from '@memory/application/commands/handlers/retire-memory.handler';
import { WriteMemoryHandler } from '@memory/application/commands/handlers/write-memory.handler';
import { RecordDeliveryCommand } from '@memory/application/commands/record-delivery.command';
import { RecordRecallCommand } from '@memory/application/commands/record-recall.command';
import { RejectMemoryCommand } from '@memory/application/commands/reject-memory.command';
import { RememberCommand } from '@memory/application/commands/remember.command';
import { RestoreMemoryCommand } from '@memory/application/commands/restore-memory.command';
import { RetireMemoryCommand } from '@memory/application/commands/retire-memory.command';
import { WriteMemoryCommand } from '@memory/application/commands/write-memory.command';
import { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import { UpkeepReactions } from '@memory/application/events/handlers/upkeep-reactions.handler';
import { MEMORY_EVENT_MAPPERS } from '@memory/application/integration-events/memory.event-mappers';
import { LINES, type LinesPort } from '@memory/application/ports/lines.port';
import {
  MEMORY_CONSOLIDATOR,
  type MemoryConsolidatorPort,
} from '@memory/application/ports/memory-consolidator.port';
import { MEMORY_LISTING } from '@memory/application/ports/memory-listing.port';
import {
  MEMORY_RELEVANCE,
  type MemoryRelevancePort,
} from '@memory/application/ports/memory-relevance.port';
import {
  MEMORY_USES,
  type MemoryUsesPort,
} from '@memory/application/ports/memory-uses.port';
import { PEOPLE, type PeoplePort } from '@memory/application/ports/people.port';
import {
  REPOSITORY_PATHS,
  type RepositoryPathsPort,
} from '@memory/application/ports/repository-paths.port';
import {
  REVIEWS,
  type ReviewsPort,
} from '@memory/application/ports/reviews.port';
import { TEAM_MEMORY_USE } from '@memory/application/ports/team-memory-use.port';
import {
  UPKEEP_NOTICES,
  type UpkeepNoticesPort,
} from '@memory/application/ports/upkeep-notices.port';
import { WORK, type WorkPort } from '@memory/application/ports/work.port';
import { ListTeamMemoriesHandler } from '@memory/application/queries/handlers/list-team-memories.handler';
import { ReadMemoryFilesHandler } from '@memory/application/queries/handlers/read-memory-files.handler';
import { ReadMemoryReviewHandler } from '@memory/application/queries/handlers/read-memory-review.handler';
import { ReadMemoryUpkeepHandler } from '@memory/application/queries/handlers/read-memory-upkeep.handler';
import { ReadProposedMemoryHandler } from '@memory/application/queries/handlers/read-proposed-memory.handler';
import { ReadRunMemoriesHandler } from '@memory/application/queries/handlers/read-run-memories.handler';
import { ReadTeamMemoryHandler } from '@memory/application/queries/handlers/read-team-memory.handler';
import { RecallMemoriesHandler } from '@memory/application/queries/handlers/recall-memories.handler';
import { RecallMemoryHandler } from '@memory/application/queries/handlers/recall-memory.handler';
import { ListTeamMemoriesQuery } from '@memory/application/queries/list-team-memories.query';
import { ReadMemoryFilesQuery } from '@memory/application/queries/read-memory-files.query';
import { ReadMemoryReviewQuery } from '@memory/application/queries/read-memory-review.query';
import { ReadMemoryUpkeepQuery } from '@memory/application/queries/read-memory-upkeep.query';
import { ReadProposedMemoryQuery } from '@memory/application/queries/read-proposed-memory.query';
import { ReadRunMemoriesQuery } from '@memory/application/queries/read-run-memories.query';
import { ReadTeamMemoryQuery } from '@memory/application/queries/read-team-memory.query';
import { RecallMemoriesQuery } from '@memory/application/queries/recall-memories.query';
import { RecallMemoryQuery } from '@memory/application/queries/recall-memory.query';
import { ApplicableMemories } from '@memory/application/services/applicable-memories.service';
import { DeleteMemoryProposalSet } from '@memory/application/services/delete-memory-proposal-set.service';
import { DeleteTeamMemories } from '@memory/application/services/delete-team-memories.service';
import { MemoriesForBriefing } from '@memory/application/services/memories-for-briefing.service';
import { MemoryAccess } from '@memory/application/services/memory-access.service';
import { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { MemoryUpkeepSweeps } from '@memory/application/services/memory-upkeep-sweeps.service';
import { RecalledMemoryViews } from '@memory/application/services/recalled-memory-views.service';
import { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { RecordRunMemoryUses } from '@memory/application/services/record-run-memory-uses.service';
import { RunProposing } from '@memory/application/services/run-proposing.service';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import { TeamMemoryLoader } from '@memory/application/services/team-memory-loader.service';
import { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import {
  MEMORY_PROPOSAL_SETS,
  type MemoryProposalSetRepository,
} from '@memory/domain/repositories/memory-proposal-set.repository';
import {
  MEMORY_UPKEEP_SCHEDULES,
  MEMORY_UPKEEPS,
  type MemoryUpkeepRepository,
  type MemoryUpkeepScheduleRepository,
} from '@memory/domain/repositories/memory-upkeep.repository';
import {
  MEMORIES,
  type MemoryRepository,
} from '@memory/domain/repositories/memory.repository';
import { Lines } from '@memory/infrastructure/acl/lines.adapter';
import { People } from '@memory/infrastructure/acl/people.adapter';
import { RepositoryPaths } from '@memory/infrastructure/acl/repository-paths.adapter';
import { Reviews } from '@memory/infrastructure/acl/reviews.adapter';
import { UpkeepNotices } from '@memory/infrastructure/acl/upkeep-notices.adapter';
import { Work } from '@memory/infrastructure/acl/work.adapter';
import { UnavailableMemoryConsolidator } from '@memory/infrastructure/consolidation/unavailable-memory-consolidator';
import { MEMORY_PAYLOAD_TYPES } from '@memory/infrastructure/events/memory-payload-types';
import { DrizzleMemoryListing } from '@memory/infrastructure/persistence/drizzle/repositories/memory-listing.reader';
import { DrizzleMemoryProposalSetRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory-proposal-set.repository';
import { DrizzleMemoryRelevance } from '@memory/infrastructure/persistence/drizzle/repositories/memory-relevance.reader';
import {
  DrizzleMemoryUpkeepRepository,
  DrizzleMemoryUpkeepScheduleRepository,
} from '@memory/infrastructure/persistence/drizzle/repositories/memory-upkeep.repository';
import { DrizzleMemoryUses } from '@memory/infrastructure/persistence/drizzle/repositories/memory-uses.ledger';
import { DrizzleMemoryRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory.repository';
import { DrizzleTeamMemoryUse } from '@memory/infrastructure/persistence/drizzle/repositories/team-memory-use.reader';
import { memorySubscribers } from '@memory/presentation/events/memory.subscribers';
import { MemoryReviewController } from '@memory/presentation/http/controllers/memory-review.controller';
import { MemoryUpkeepController } from '@memory/presentation/http/controllers/memory-upkeep.controller';
import { RunMemoriesController } from '@memory/presentation/http/controllers/run-memories.controller';
import { RunnerMemoryFilesController } from '@memory/presentation/http/controllers/runner-memory-files.controller';
import { RunnerMemoryController } from '@memory/presentation/http/controllers/runner-memory.controller';
import { TeamMemoryController } from '@memory/presentation/http/controllers/team-memory.controller';
import type { Provider, Type } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { PendingJobWorker } from '@platform/workers/pending-job.worker';
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
  INBOX_REQUESTS,
  type InboxRequestsPort,
} from '@work/application/ports/inbox-requests.port';
import { MEMORIES_BRIEFED_BEFORE } from '@work/application/ports/memories-briefed-before.port';
import {
  NOTICES,
  type NoticesPort,
} from '@work/application/ports/notices.port';
import { TEAM_MEMORIES } from '@work/application/ports/team-memories.port';
import {
  WORK_RUN_LOOKUP,
  type WorkRunLookupPort,
} from '@work/application/ports/work-run-lookup.port';
import {
  WORK_TASK_LOOKUP,
  type WorkTaskLookupPort,
} from '@work/application/ports/work-task-lookup.port';

const MEMORY_EVENTS = Symbol('MEMORY_EVENTS');

export const MEMORY_CONTROLLERS: readonly Type[] = [
  MemoryReviewController,
  TeamMemoryController,
  RunMemoriesController,
  RunnerMemoryController,
  RunnerMemoryFilesController,
  MemoryUpkeepController,
];

export const MEMORY_PROVIDERS: readonly Provider[] = [
  {
    provide: WORK,
    inject: [WORK_RUN_LOOKUP, WORK_TASK_LOOKUP],
    useFactory: (runs: WorkRunLookupPort, tasks: WorkTaskLookupPort) =>
      new Work(runs, tasks),
  },
  {
    provide: LINES,
    inject: [LINES_VIEW],
    useFactory: (lines: LinesViewPort) => new Lines(lines),
  },
  {
    provide: REVIEWS,
    inject: [INBOX_REQUESTS],
    useFactory: (inboxRequests: InboxRequestsPort) =>
      new Reviews(inboxRequests),
  },
  {
    provide: PEOPLE,
    inject: [WORKSPACE_ACCESS, PERSON_READER],
    useFactory: (access: WorkspaceAccessPort, people: PersonReaderPort) =>
      new People(access, people),
  },
  {
    provide: MEMORY_PROPOSAL_SETS,
    useClass: DrizzleMemoryProposalSetRepository,
  },
  { provide: MEMORIES, useClass: DrizzleMemoryRepository },
  { provide: MEMORY_UPKEEPS, useClass: DrizzleMemoryUpkeepRepository },
  {
    provide: MEMORY_UPKEEP_SCHEDULES,
    useClass: DrizzleMemoryUpkeepScheduleRepository,
  },
  {
    provide: REPOSITORY_PATHS,
    inject: [REPOSITORY_CONTENTS],
    useFactory: (contents: RepositoryContentsPort) =>
      new RepositoryPaths(contents),
  },
  {
    provide: UPKEEP_NOTICES,
    inject: [NOTICES],
    useFactory: (notices: NoticesPort) => new UpkeepNotices(notices),
  },
  {
    provide: MEMORY_CONSOLIDATOR,
    useClass: UnavailableMemoryConsolidator,
  },
  {
    provide: UpkeepReactions,
    inject: [
      UPKEEP_NOTICES,
      MEMORIES,
      MEMORY_UPKEEPS,
      MEMORY_UPKEEP_SCHEDULES,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      notices: UpkeepNoticesPort,
      memories: MemoryRepository,
      upkeeps: MemoryUpkeepRepository,
      schedules: MemoryUpkeepScheduleRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new UpkeepReactions(
        notices,
        memories,
        upkeeps,
        schedules,
        transaction,
        clock,
      ),
  },
  {
    provide: MemoryUpkeepSweeps,
    inject: [
      MEMORY_UPKEEP_SCHEDULES,
      MEMORY_UPKEEPS,
      MEMORIES,
      LINES,
      MEMORY_USES,
      REPOSITORY_PATHS,
      MEMORY_CONSOLIDATOR,
      ID_GENERATOR,
      CLOCK,
      LOGGER,
      TRANSACTION,
      ERROR_REPORTS,
      TELEMETRY,
    ],
    useFactory: (
      schedules: MemoryUpkeepScheduleRepository,
      upkeeps: MemoryUpkeepRepository,
      memories: MemoryRepository,
      lines: LinesPort,
      uses: MemoryUsesPort,
      paths: RepositoryPathsPort,
      consolidator: MemoryConsolidatorPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      logger: LoggerPort,
      transaction: TransactionPort,
      reports: ErrorReportsPort,
      telemetry: TelemetryPort,
    ) =>
      new MemoryUpkeepSweeps(
        schedules,
        upkeeps,
        memories,
        lines,
        uses,
        paths,
        consolidator,
        ids,
        clock,
        logger,
        transaction,
        reports,
        telemetry,
      ),
  },
  ...bindCommandHandler(
    DecideUpkeepProposalCommand,
    DecideUpkeepProposalHandler,
    [MemoryAccess, MEMORY_UPKEEPS, MEMORIES, ID_GENERATOR, TRANSACTION, CLOCK],
  ),
  ...bindQueryHandler(ReadMemoryUpkeepQuery, ReadMemoryUpkeepHandler, [
    MemoryAccess,
    MEMORY_UPKEEPS,
    MEMORIES,
    PEOPLE,
  ]),
  { provide: MEMORY_LISTING, useClass: DrizzleMemoryListing },
  { provide: MEMORY_RELEVANCE, useClass: DrizzleMemoryRelevance },
  {
    provide: ApplicableMemories,
    inject: [MEMORIES, MEMORY_RELEVANCE],
    useFactory: (memories: MemoryRepository, relevance: MemoryRelevancePort) =>
      new ApplicableMemories(memories, relevance),
  },
  {
    provide: MemoriesForBriefing,
    inject: [ApplicableMemories, MEMORY_RELEVANCE, MEMORY_USES, MEMORIES],
    useFactory: (
      applicable: ApplicableMemories,
      relevance: MemoryRelevancePort,
      uses: MemoryUsesPort,
      memories: MemoryRepository,
    ) => new MemoriesForBriefing(applicable, relevance, uses, memories),
  },
  { provide: TEAM_MEMORIES, useExisting: MemoriesForBriefing },
  { provide: MEMORIES_BRIEFED_BEFORE, useExisting: MemoriesForBriefing },
  {
    provide: MemoryAccess,
    inject: [PEOPLE, WORK],
    useFactory: (people: PeoplePort, work: WorkPort) =>
      new MemoryAccess(people, work),
  },
  {
    provide: RunProposing,
    inject: [
      RunnerMemoryLoader,
      WORK,
      MEMORY_PROPOSAL_SETS,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      loader: RunnerMemoryLoader,
      work: WorkPort,
      sets: MemoryProposalSetRepository,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new RunProposing(loader, work, sets, transaction, ids, clock),
  },
  {
    provide: MemoryReviews,
    inject: [WORK, PEOPLE, MEMORIES],
    useFactory: (
      work: WorkPort,
      people: PeoplePort,
      memories: MemoryRepository,
    ) => new MemoryReviews(work, people, memories),
  },
  {
    provide: MemoryReactions,
    inject: [REVIEWS, MEMORY_PROPOSAL_SETS, MEMORIES, TRANSACTION, CLOCK],
    useFactory: (
      reviews: ReviewsPort,
      sets: MemoryProposalSetRepository,
      memories: MemoryRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new MemoryReactions(reviews, sets, memories, transaction, clock),
  },
  ...bindCommandHandler(ApproveMemoriesCommand, ApproveMemoriesHandler, [
    MemoryAccess,
    MEMORY_PROPOSAL_SETS,
    MEMORIES,
    TRANSACTION,
    CLOCK,
  ]),
  ...bindCommandHandler(RejectMemoryCommand, RejectMemoryHandler, [
    MemoryAccess,
    MEMORY_PROPOSAL_SETS,
    TRANSACTION,
    CLOCK,
  ]),
  ...bindCommandHandler(RestoreMemoryCommand, RestoreMemoryHandler, [
    MemoryAccess,
    MEMORY_PROPOSAL_SETS,
    TRANSACTION,
  ]),
  {
    provide: TeamMemoryLoader,
    inject: [MEMORIES, LINES],
    useFactory: (memories: MemoryRepository, lines: LinesPort) =>
      new TeamMemoryLoader(memories, lines),
  },
  { provide: MEMORY_USES, useClass: DrizzleMemoryUses },
  { provide: TEAM_MEMORY_USE, useClass: DrizzleTeamMemoryUse },
  {
    provide: TeamMemoryViews,
    inject: [MEMORIES, PEOPLE, MEMORY_USES],
    useFactory: (
      memories: MemoryRepository,
      people: PeoplePort,
      uses: MemoryUsesPort,
    ) => new TeamMemoryViews(memories, people, uses),
  },
  {
    provide: RecalledMemoryViews,
    inject: [TeamMemoryViews, WORK, PEOPLE],
    useFactory: (views: TeamMemoryViews, work: WorkPort, people: PeoplePort) =>
      new RecalledMemoryViews(views, work, people),
  },
  {
    provide: RecordMemoryUses,
    inject: [MEMORY_USES, TRANSACTION, CLOCK],
    useFactory: (
      uses: MemoryUsesPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RecordMemoryUses(uses, transaction, clock),
  },
  {
    provide: RecordRunMemoryUses,
    inject: [RecordMemoryUses, WORK, MEMORIES],
    useFactory: (
      recording: RecordMemoryUses,
      work: WorkPort,
      memories: MemoryRepository,
    ) => new RecordRunMemoryUses(recording, work, memories),
  },
  ...bindQueryHandler(ReadMemoryFilesQuery, ReadMemoryFilesHandler, [
    RunnerMemoryLoader,
    ApplicableMemories,
    MEMORIES,
    LINES,
    PEOPLE,
    WORK,
  ]),
  ...bindCommandHandler(WriteMemoryCommand, WriteMemoryHandler, [
    MemoryAccess,
    TeamMemoryLoader,
    MEMORIES,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(EditMemoryCommand, EditMemoryHandler, [
    MemoryAccess,
    TeamMemoryLoader,
    MEMORIES,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(RetireMemoryCommand, RetireMemoryHandler, [
    MemoryAccess,
    TeamMemoryLoader,
    MEMORIES,
    TRANSACTION,
    CLOCK,
  ]),
  ...bindQueryHandler(ListTeamMemoriesQuery, ListTeamMemoriesHandler, [
    MemoryAccess,
    MEMORY_LISTING,
    MEMORIES,
    TeamMemoryViews,
  ]),
  ...bindQueryHandler(ReadRunMemoriesQuery, ReadRunMemoriesHandler, [
    MemoryAccess,
    WORK,
    MEMORIES,
    MEMORY_PROPOSAL_SETS,
    MEMORY_USES,
    MemoryReviews,
    TeamMemoryViews,
    REVIEWS,
  ]),
  ...bindQueryHandler(ReadTeamMemoryQuery, ReadTeamMemoryHandler, [
    MemoryAccess,
    TeamMemoryLoader,
    TeamMemoryViews,
  ]),
  ...bindQueryHandler(ReadMemoryReviewQuery, ReadMemoryReviewHandler, [
    MemoryAccess,
    MEMORY_PROPOSAL_SETS,
    MemoryReviews,
  ]),
  {
    provide: RunnerMemoryLoader,
    inject: [WORK],
    useFactory: (work: WorkPort) => new RunnerMemoryLoader(work),
  },
  ...bindQueryHandler(RecallMemoriesQuery, RecallMemoriesHandler, [
    RunnerMemoryLoader,
    ApplicableMemories,
    TeamMemoryViews,
  ]),
  ...bindQueryHandler(RecallMemoryQuery, RecallMemoryHandler, [
    RunnerMemoryLoader,
    MEMORIES,
    RecalledMemoryViews,
  ]),
  ...bindCommandHandler(RecordRecallCommand, RecordRecallHandler, [
    RunnerMemoryLoader,
    MEMORIES,
    RecordMemoryUses,
  ]),
  ...bindCommandHandler(RecordDeliveryCommand, RecordDeliveryHandler, [
    RunnerMemoryLoader,
    MEMORIES,
    RecordMemoryUses,
  ]),
  ...bindCommandHandler(RememberCommand, RememberHandler, [
    RunProposing,
    MEMORIES,
  ]),
  ...bindCommandHandler(ForgetCommand, ForgetHandler, [RunProposing, MEMORIES]),
  ...bindQueryHandler(ReadProposedMemoryQuery, ReadProposedMemoryHandler, [
    RunnerMemoryLoader,
    MEMORY_PROPOSAL_SETS,
    MemoryReviews,
  ]),
  {
    provide: DeleteMemoryProposalSet,
    inject: [MEMORY_PROPOSAL_SETS],
    useFactory: (sets: MemoryProposalSetRepository) =>
      new DeleteMemoryProposalSet(sets),
  },
  {
    provide: DeleteTeamMemories,
    inject: [MEMORIES, TRANSACTION, MEMORY_UPKEEPS, MEMORY_UPKEEP_SCHEDULES],
    useFactory: (
      memories: MemoryRepository,
      transaction: TransactionPort,
      upkeeps: MemoryUpkeepRepository,
      schedules: MemoryUpkeepScheduleRepository,
    ) => new DeleteTeamMemories(memories, transaction, upkeeps, schedules),
  },
  {
    provide: PendingJobWorker,
    inject: [MemoryUpkeepSweeps, LOGGER],
    useFactory: (sweeps: MemoryUpkeepSweeps, logger: LoggerPort) =>
      new PendingJobWorker([sweeps], logger),
  },
  {
    provide: MEMORY_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      DeleteMemoryProposalSet,
      DeleteTeamMemories,
      MemoryReactions,
      RecordRunMemoryUses,
      UpkeepReactions,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      deleting: DeleteMemoryProposalSet,
      deletingMemories: DeleteTeamMemories,
      reactions: MemoryReactions,
      recording: RecordRunMemoryUses,
      upkeep: UpkeepReactions,
    ) => {
      types.register('memory', MEMORY_PAYLOAD_TYPES);
      mappers.register(MEMORY_EVENT_MAPPERS);
      subscribers.register(
        memorySubscribers(
          deleting,
          deletingMemories,
          reactions,
          recording,
          upkeep,
        ),
      );
      return true;
    },
  },
];
