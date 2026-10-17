import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { ApproveMemoriesCommand } from '@memory/application/commands/approve-memories.command';
import { EditMemoryCommand } from '@memory/application/commands/edit-memory.command';
import { ApproveMemoriesHandler } from '@memory/application/commands/handlers/approve-memories.handler';
import { EditMemoryHandler } from '@memory/application/commands/handlers/edit-memory.handler';
import { RecallMemoriesHandler } from '@memory/application/commands/handlers/recall-memories.handler';
import { RecallMemoryHandler } from '@memory/application/commands/handlers/recall-memory.handler';
import { RejectMemoryHandler } from '@memory/application/commands/handlers/reject-memory.handler';
import { RememberHandler } from '@memory/application/commands/handlers/remember.handler';
import { RetireMemoryHandler } from '@memory/application/commands/handlers/retire-memory.handler';
import { WriteMemoryHandler } from '@memory/application/commands/handlers/write-memory.handler';
import { RecallMemoriesCommand } from '@memory/application/commands/recall-memories.command';
import { RecallMemoryCommand } from '@memory/application/commands/recall-memory.command';
import { RejectMemoryCommand } from '@memory/application/commands/reject-memory.command';
import { RememberCommand } from '@memory/application/commands/remember.command';
import { RetireMemoryCommand } from '@memory/application/commands/retire-memory.command';
import { WriteMemoryCommand } from '@memory/application/commands/write-memory.command';
import { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import { MEMORY_EVENT_MAPPERS } from '@memory/application/integration-events/memory.event-mappers';
import {
  MEMORY_DRAFTER,
  type MemoryDrafterPort,
} from '@memory/application/ports/memory-drafter.port';
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
import { ReadRunMemoriesHandler } from '@memory/application/queries/handlers/read-run-memories.handler';
import { ReadTeamMemoryHandler } from '@memory/application/queries/handlers/read-team-memory.handler';
import { ListTeamMemoriesQuery } from '@memory/application/queries/list-team-memories.query';
import { ReadMemoryFilesQuery } from '@memory/application/queries/read-memory-files.query';
import { ReadMemoryReviewQuery } from '@memory/application/queries/read-memory-review.query';
import { ReadRunMemoriesQuery } from '@memory/application/queries/read-run-memories.query';
import { ReadTeamMemoryQuery } from '@memory/application/queries/read-team-memory.query';
import { AskForMemories } from '@memory/application/services/ask-for-memories.service';
import { DeleteMemoryDraft } from '@memory/application/services/delete-memory-draft.service';
import { MemoriesForBriefing } from '@memory/application/services/memories-for-briefing.service';
import { MemoriesInReach } from '@memory/application/services/memories-in-reach.service';
import { MemoryAccess } from '@memory/application/services/memory-access.service';
import { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { NoteMemoryUses } from '@memory/application/services/note-memory-uses.service';
import { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import { TeamMemoryLoader } from '@memory/application/services/team-memory-loader.service';
import { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { WorkMemoryDrafts } from '@memory/application/services/work-memory-drafts.service';
import { MEMORY_PAYLOAD_TYPES } from '@memory/domain/payload-types';
import { People } from '@memory/infrastructure/acl/people.adapter';
import { Reviews } from '@memory/infrastructure/acl/reviews.adapter';
import { Work } from '@memory/infrastructure/acl/work.adapter';
import { OpenRouterMemoryDrafter } from '@memory/infrastructure/drafting/openrouter-memory.drafter';
import { DrizzleMemoryRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory.repository';
import { DrizzleMemoryDraftRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory-draft.repository';
import { DrizzleMemoryRelevance } from '@memory/infrastructure/persistence/drizzle/repositories/memory-relevance.reader';
import { DrizzleMemoryUses } from '@memory/infrastructure/persistence/drizzle/repositories/memory-uses.ledger';
import { DrizzleRejectedMemories } from '@memory/infrastructure/persistence/drizzle/repositories/rejected-memories.reader';
import { DrizzleTeamMemoryUse } from '@memory/infrastructure/persistence/drizzle/repositories/team-memory-use.reader';
import { memorySubscribers } from '@memory/presentation/events/memory.subscribers';
import { MemoryReviewController } from '@memory/presentation/http/controllers/memory-review.controller';
import { RunMemoriesController } from '@memory/presentation/http/controllers/run-memories.controller';
import { RunnerMemoryController } from '@memory/presentation/http/controllers/runner-memory.controller';
import { RunnerMemoryFilesController } from '@memory/presentation/http/controllers/runner-memory-files.controller';
import { TeamMemoryController } from '@memory/presentation/http/controllers/team-memory.controller';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
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
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
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
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { MEMORIES_BRIEFED_BEFORE } from '@work/application/ports/memories-briefed-before.port';
import {
  TASK_ASIDES,
  type TaskAsidesPort,
} from '@work/application/ports/task-asides.port';
import { TEAM_MEMORIES } from '@work/application/ports/team-memories.port';
import {
  WORK_LOOKUP,
  type WorkLookupPort,
} from '@work/application/ports/work-lookup.port';

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
    inject: [WORK_LOOKUP],
    useFactory: (work: WorkLookupPort) => new Work(work),
  },
  {
    provide: REVIEWS,
    inject: [TASK_ASIDES],
    useFactory: (asides: TaskAsidesPort) => new Reviews(asides),
  },
  {
    provide: PEOPLE,
    inject: [WORKSPACE_ACCESS, PERSON_READER],
    useFactory: (access: WorkspaceAccessPort, people: PersonReaderPort) =>
      new People(access, people),
  },
  DrizzleMemoryDraftRepository,
  DrizzleMemoryRepository,
  { provide: MEMORY_RELEVANCE, useClass: DrizzleMemoryRelevance },
  {
    provide: MemoriesInReach,
    inject: [DrizzleMemoryRepository, MEMORY_RELEVANCE],
    useFactory: (
      memories: DrizzleMemoryRepository,
      relevance: MemoryRelevancePort,
    ) => new MemoriesInReach(memories, relevance),
  },
  {
    provide: MemoriesForBriefing,
    inject: [
      MemoriesInReach,
      MEMORY_RELEVANCE,
      MEMORY_USES,
      DrizzleMemoryRepository,
    ],
    useFactory: (
      inReach: MemoriesInReach,
      relevance: MemoryRelevancePort,
      uses: MemoryUsesPort,
      memories: DrizzleMemoryRepository,
    ) => new MemoriesForBriefing(inReach, relevance, uses, memories),
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
    inject: [REVIEWS, DrizzleMemoryRepository, TRANSACTION, CLOCK],
    useFactory: (
      reviews: ReviewsPort,
      memories: DrizzleMemoryRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new MemoryReactions(reviews, memories, transaction, clock),
  },
  ...bindCommandHandler(ApproveMemoriesCommand, ApproveMemoriesHandler, [
    MemoryAccess,
    DrizzleMemoryDraftRepository,
    MemoryReviews,
    TRANSACTION,
    CLOCK,
  ]),
  ...bindCommandHandler(RejectMemoryCommand, RejectMemoryHandler, [
    MemoryAccess,
    DrizzleMemoryDraftRepository,
    MemoryReviews,
    TRANSACTION,
    CLOCK,
  ]),
  {
    provide: TeamMemoryLoader,
    inject: [DrizzleMemoryRepository, WORK],
    useFactory: (memories: DrizzleMemoryRepository, work: WorkPort) =>
      new TeamMemoryLoader(memories, work),
  },
  { provide: MEMORY_USES, useClass: DrizzleMemoryUses },
  { provide: TEAM_MEMORY_USE, useClass: DrizzleTeamMemoryUse },
  {
    provide: TeamMemoryViews,
    inject: [DrizzleMemoryRepository, WORK, PEOPLE, MEMORY_USES],
    useFactory: (
      memories: DrizzleMemoryRepository,
      work: WorkPort,
      people: PeoplePort,
      uses: MemoryUsesPort,
    ) => new TeamMemoryViews(memories, work, people, uses),
  },
  {
    provide: RecordMemoryUses,
    inject: [MEMORY_USES, DOMAIN_EVENT_DISPATCHER, TRANSACTION, CLOCK],
    useFactory: (
      uses: MemoryUsesPort,
      events: DomainEventDispatcher,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RecordMemoryUses(uses, events, transaction, clock),
  },
  {
    provide: NoteMemoryUses,
    inject: [RecordMemoryUses, WORK, DrizzleMemoryRepository],
    useFactory: (
      recording: RecordMemoryUses,
      work: WorkPort,
      memories: DrizzleMemoryRepository,
    ) => new NoteMemoryUses(recording, work, memories),
  },
  ...bindQueryHandler(ReadMemoryFilesQuery, ReadMemoryFilesHandler, [
    RunnerMemoryLoader,
    MemoriesInReach,
    DrizzleMemoryRepository,
    WORK,
    PEOPLE,
  ]),
  ...bindCommandHandler(WriteMemoryCommand, WriteMemoryHandler, [
    MemoryAccess,
    TeamMemoryLoader,
    DrizzleMemoryRepository,
    TeamMemoryViews,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(EditMemoryCommand, EditMemoryHandler, [
    MemoryAccess,
    TeamMemoryLoader,
    DrizzleMemoryRepository,
    TeamMemoryViews,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(RetireMemoryCommand, RetireMemoryHandler, [
    MemoryAccess,
    TeamMemoryLoader,
    DrizzleMemoryRepository,
    TeamMemoryViews,
    TRANSACTION,
    CLOCK,
  ]),
  ...bindQueryHandler(ListTeamMemoriesQuery, ListTeamMemoriesHandler, [
    MemoryAccess,
    DrizzleMemoryRepository,
    TeamMemoryViews,
  ]),
  ...bindQueryHandler(ReadRunMemoriesQuery, ReadRunMemoriesHandler, [
    MemoryAccess,
    WORK,
    DrizzleMemoryRepository,
    DrizzleMemoryDraftRepository,
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
    DrizzleMemoryDraftRepository,
    MemoryReviews,
  ]),
  {
    provide: RunnerMemoryLoader,
    inject: [WORK, RecordMemoryUses],
    useFactory: (work: WorkPort, recording: RecordMemoryUses) =>
      new RunnerMemoryLoader(work, recording),
  },
  ...bindCommandHandler(RecallMemoriesCommand, RecallMemoriesHandler, [
    RunnerMemoryLoader,
    MemoriesInReach,
    TeamMemoryViews,
  ]),
  ...bindCommandHandler(RecallMemoryCommand, RecallMemoryHandler, [
    RunnerMemoryLoader,
    DrizzleMemoryRepository,
    TeamMemoryViews,
  ]),
  ...bindCommandHandler(RememberCommand, RememberHandler, [
    RunnerMemoryLoader,
    WORK,
    DrizzleMemoryDraftRepository,
    DrizzleMemoryRepository,
    MemoryReviews,
    TRANSACTION,
    ID_GENERATOR,
    CLOCK,
  ]),
  { provide: REJECTED_MEMORIES, useClass: DrizzleRejectedMemories },
  {
    provide: MEMORY_DRAFTER,
    inject: [ENV],
    useFactory: (env: Env) =>
      new OpenRouterMemoryDrafter(env.OPENROUTER_API_KEY, env.MEMORIES_MODEL),
  },
  {
    provide: AskForMemories,
    inject: [
      WORK,
      DrizzleMemoryDraftRepository,
      MEMORY_DRAFTER,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      drafts: DrizzleMemoryDraftRepository,
      drafter: MemoryDrafterPort,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new AskForMemories(work, drafts, drafter, transaction, ids, clock),
  },
  {
    provide: DeleteMemoryDraft,
    inject: [DrizzleMemoryDraftRepository],
    useFactory: (drafts: DrizzleMemoryDraftRepository) =>
      new DeleteMemoryDraft(drafts),
  },
  {
    provide: WorkMemoryDrafts,
    inject: [
      DrizzleMemoryDraftRepository,
      WORK,
      MemoriesInReach,
      REJECTED_MEMORIES,
      MEMORY_DRAFTER,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
    ],
    useFactory: (
      drafts: DrizzleMemoryDraftRepository,
      work: WorkPort,
      inReach: MemoriesInReach,
      rejections: RejectedMemoriesPort,
      drafter: MemoryDrafterPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
    ) =>
      new WorkMemoryDrafts(
        drafts,
        work,
        inReach,
        rejections,
        drafter,
        ids,
        clock,
        transaction,
        logger,
        reports,
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
      AskForMemories,
      DeleteMemoryDraft,
      MemoryReactions,
      NoteMemoryUses,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      asking: AskForMemories,
      deleting: DeleteMemoryDraft,
      reactions: MemoryReactions,
      noting: NoteMemoryUses,
    ) => {
      types.register('memory', MEMORY_PAYLOAD_TYPES);
      mappers.register(MEMORY_EVENT_MAPPERS);
      subscribers.register(
        memorySubscribers(asking, deleting, reactions, noting),
      );
      return true;
    },
  },
];
