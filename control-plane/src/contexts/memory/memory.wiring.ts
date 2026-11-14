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
import { EditMemoryCommand } from '@memory/application/commands/edit-memory.command';
import { ApproveMemoriesHandler } from '@memory/application/commands/handlers/approve-memories.handler';
import { EditMemoryHandler } from '@memory/application/commands/handlers/edit-memory.handler';
import { RecordRecallHandler } from '@memory/application/commands/handlers/record-recall.handler';
import { RejectMemoryHandler } from '@memory/application/commands/handlers/reject-memory.handler';
import { RememberHandler } from '@memory/application/commands/handlers/remember.handler';
import { RetireMemoryHandler } from '@memory/application/commands/handlers/retire-memory.handler';
import { WriteMemoryHandler } from '@memory/application/commands/handlers/write-memory.handler';
import { RecordRecallCommand } from '@memory/application/commands/record-recall.command';
import { RejectMemoryCommand } from '@memory/application/commands/reject-memory.command';
import { RememberCommand } from '@memory/application/commands/remember.command';
import { RetireMemoryCommand } from '@memory/application/commands/retire-memory.command';
import { WriteMemoryCommand } from '@memory/application/commands/write-memory.command';
import { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import { MEMORY_EVENT_MAPPERS } from '@memory/application/integration-events/memory.event-mappers';
import { LINES, type LinesPort } from '@memory/application/ports/lines.port';
import {
  MEMORY_DRAFTER,
  type MemoryDrafterPort,
} from '@memory/application/ports/memory-drafter.port';
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
  REJECTED_MEMORIES,
  type RejectedMemoriesPort,
} from '@memory/application/ports/rejected-memories.port';
import {
  REVIEWS,
  type ReviewsPort,
} from '@memory/application/ports/reviews.port';
import { TEAM_MEMORY_USE } from '@memory/application/ports/team-memory-use.port';
import { WORK, type WorkPort } from '@memory/application/ports/work.port';
import { ListTeamMemoriesHandler } from '@memory/application/queries/handlers/list-team-memories.handler';
import { ReadMemoryFilesHandler } from '@memory/application/queries/handlers/read-memory-files.handler';
import { ReadMemoryReviewHandler } from '@memory/application/queries/handlers/read-memory-review.handler';
import { ReadProposedMemoryHandler } from '@memory/application/queries/handlers/read-proposed-memory.handler';
import { ReadRunMemoriesHandler } from '@memory/application/queries/handlers/read-run-memories.handler';
import { ReadTeamMemoryHandler } from '@memory/application/queries/handlers/read-team-memory.handler';
import { RecallMemoriesHandler } from '@memory/application/queries/handlers/recall-memories.handler';
import { RecallMemoryHandler } from '@memory/application/queries/handlers/recall-memory.handler';
import { ListTeamMemoriesQuery } from '@memory/application/queries/list-team-memories.query';
import { ReadMemoryFilesQuery } from '@memory/application/queries/read-memory-files.query';
import { ReadMemoryReviewQuery } from '@memory/application/queries/read-memory-review.query';
import { ReadProposedMemoryQuery } from '@memory/application/queries/read-proposed-memory.query';
import { ReadRunMemoriesQuery } from '@memory/application/queries/read-run-memories.query';
import { ReadTeamMemoryQuery } from '@memory/application/queries/read-team-memory.query';
import { RecallMemoriesQuery } from '@memory/application/queries/recall-memories.query';
import { RecallMemoryQuery } from '@memory/application/queries/recall-memory.query';
import { ApplicableMemories } from '@memory/application/services/applicable-memories.service';
import { DeleteMemoryDraft } from '@memory/application/services/delete-memory-draft.service';
import { DeleteTeamMemories } from '@memory/application/services/delete-team-memories.service';
import { MemoriesForBriefing } from '@memory/application/services/memories-for-briefing.service';
import { MemoryAccess } from '@memory/application/services/memory-access.service';
import { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { RecordRunMemoryUses } from '@memory/application/services/record-run-memory-uses.service';
import { RequestMemories } from '@memory/application/services/request-memories.service';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import { TeamMemoryLoader } from '@memory/application/services/team-memory-loader.service';
import { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { WorkMemoryDrafts } from '@memory/application/services/work-memory-drafts.service';
import {
  MEMORY_DRAFTS,
  type MemoryDraftRepository,
} from '@memory/domain/repositories/memory-draft.repository';
import {
  MEMORIES,
  type MemoryRepository,
} from '@memory/domain/repositories/memory.repository';
import { Lines } from '@memory/infrastructure/acl/lines.adapter';
import { People } from '@memory/infrastructure/acl/people.adapter';
import { Reviews } from '@memory/infrastructure/acl/reviews.adapter';
import { Work } from '@memory/infrastructure/acl/work.adapter';
import { ChatCompletionsMemoryDrafter } from '@memory/infrastructure/drafting/chat-completions-memory.drafter';
import { MEMORY_PAYLOAD_TYPES } from '@memory/infrastructure/events/memory-payload-types';
import { DrizzleMemoryDraftRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory-draft.repository';
import { DrizzleMemoryListing } from '@memory/infrastructure/persistence/drizzle/repositories/memory-listing.reader';
import { DrizzleMemoryRelevance } from '@memory/infrastructure/persistence/drizzle/repositories/memory-relevance.reader';
import { DrizzleMemoryUses } from '@memory/infrastructure/persistence/drizzle/repositories/memory-uses.ledger';
import { DrizzleMemoryRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory.repository';
import { DrizzleRejectedMemories } from '@memory/infrastructure/persistence/drizzle/repositories/rejected-memories.reader';
import { DrizzleTeamMemoryUse } from '@memory/infrastructure/persistence/drizzle/repositories/team-memory-use.reader';
import { memorySubscribers } from '@memory/presentation/events/memory.subscribers';
import { MemoryReviewController } from '@memory/presentation/http/controllers/memory-review.controller';
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
  INFERENCE_CALLS,
  type InferenceCallsPort,
} from '@shared-kernel/application/ports/inference-calls.port';
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
  { provide: MEMORY_DRAFTS, useClass: DrizzleMemoryDraftRepository },
  { provide: MEMORIES, useClass: DrizzleMemoryRepository },
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
    provide: MemoryReviews,
    inject: [WORK, PEOPLE],
    useFactory: (work: WorkPort, people: PeoplePort) =>
      new MemoryReviews(work, people),
  },
  {
    provide: MemoryReactions,
    inject: [REVIEWS, MEMORIES, TRANSACTION, CLOCK],
    useFactory: (
      reviews: ReviewsPort,
      memories: MemoryRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new MemoryReactions(reviews, memories, transaction, clock),
  },
  ...bindCommandHandler(ApproveMemoriesCommand, ApproveMemoriesHandler, [
    MemoryAccess,
    MEMORY_DRAFTS,
    TRANSACTION,
    CLOCK,
  ]),
  ...bindCommandHandler(RejectMemoryCommand, RejectMemoryHandler, [
    MemoryAccess,
    MEMORY_DRAFTS,
    TRANSACTION,
    CLOCK,
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
    inject: [MEMORIES, WORK, PEOPLE, MEMORY_USES],
    useFactory: (
      memories: MemoryRepository,
      work: WorkPort,
      people: PeoplePort,
      uses: MemoryUsesPort,
    ) => new TeamMemoryViews(memories, work, people, uses),
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
    MEMORY_DRAFTS,
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
    MEMORY_DRAFTS,
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
    TeamMemoryViews,
  ]),
  ...bindCommandHandler(RecordRecallCommand, RecordRecallHandler, [
    RunnerMemoryLoader,
    MEMORIES,
    RecordMemoryUses,
  ]),
  ...bindCommandHandler(RememberCommand, RememberHandler, [
    RunnerMemoryLoader,
    WORK,
    MEMORY_DRAFTS,
    MEMORIES,
    TRANSACTION,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindQueryHandler(ReadProposedMemoryQuery, ReadProposedMemoryHandler, [
    RunnerMemoryLoader,
    MEMORY_DRAFTS,
    MemoryReviews,
  ]),
  { provide: REJECTED_MEMORIES, useClass: DrizzleRejectedMemories },
  {
    provide: MEMORY_DRAFTER,
    inject: [INFERENCE_CALLS],
    useFactory: (calls: InferenceCallsPort) =>
      new ChatCompletionsMemoryDrafter(calls),
  },
  {
    provide: RequestMemories,
    inject: [
      WORK,
      MEMORY_DRAFTS,
      MEMORY_DRAFTER,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      drafts: MemoryDraftRepository,
      drafter: MemoryDrafterPort,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new RequestMemories(work, drafts, drafter, transaction, ids, clock),
  },
  {
    provide: DeleteMemoryDraft,
    inject: [MEMORY_DRAFTS],
    useFactory: (drafts: MemoryDraftRepository) =>
      new DeleteMemoryDraft(drafts),
  },
  {
    provide: DeleteTeamMemories,
    inject: [MEMORIES, TRANSACTION],
    useFactory: (memories: MemoryRepository, transaction: TransactionPort) =>
      new DeleteTeamMemories(memories, transaction),
  },
  {
    provide: WorkMemoryDrafts,
    inject: [
      MEMORY_DRAFTS,
      WORK,
      ApplicableMemories,
      REJECTED_MEMORIES,
      MEMORY_DRAFTER,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
      TELEMETRY,
    ],
    useFactory: (
      drafts: MemoryDraftRepository,
      work: WorkPort,
      applicable: ApplicableMemories,
      rejections: RejectedMemoriesPort,
      drafter: MemoryDrafterPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
      telemetry: TelemetryPort,
    ) =>
      new WorkMemoryDrafts(
        drafts,
        work,
        applicable,
        rejections,
        drafter,
        ids,
        clock,
        transaction,
        logger,
        reports,
        telemetry,
      ),
  },
  {
    provide: PendingJobWorker,
    inject: [WorkMemoryDrafts, LOGGER],
    useFactory: (drafts: WorkMemoryDrafts, logger: LoggerPort) =>
      new PendingJobWorker([drafts], logger),
  },
  {
    provide: MEMORY_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      RequestMemories,
      DeleteMemoryDraft,
      DeleteTeamMemories,
      MemoryReactions,
      RecordRunMemoryUses,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      requesting: RequestMemories,
      deleting: DeleteMemoryDraft,
      deletingMemories: DeleteTeamMemories,
      reactions: MemoryReactions,
      recording: RecordRunMemoryUses,
    ) => {
      types.register('memory', MEMORY_PAYLOAD_TYPES);
      mappers.register(MEMORY_EVENT_MAPPERS);
      subscribers.register(
        memorySubscribers(
          requesting,
          deleting,
          deletingMemories,
          reactions,
          recording,
        ),
      );
      return true;
    },
  },
];
