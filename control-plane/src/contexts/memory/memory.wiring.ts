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
import {
  KNOWN_MEMORIES,
  type KnownMemoriesPort,
} from '@memory/application/ports/known-memories.port';
import {
  MEMORY_DRAFTER,
  type MemoryDrafterPort,
} from '@memory/application/ports/memory-drafter.port';
import {
  MEMORY_USES,
  type MemoryUsesPort,
} from '@memory/application/ports/memory-uses.port';
import { PEOPLE, type PeoplePort } from '@memory/application/ports/people.port';
import {
  REVIEWS,
  type ReviewsPort,
} from '@memory/application/ports/reviews.port';
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
import { ForgetMemoryDraft } from '@memory/application/services/forget-memory-draft.service';
import { MemoriesForBriefing } from '@memory/application/services/memories-for-briefing.service';
import { MemoryAccess } from '@memory/application/services/memory-access.service';
import { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { NoteMemoryUses } from '@memory/application/services/note-memory-uses.service';
import { RunnerMemoryAtHand } from '@memory/application/services/runner-memory-at-hand.service';
import { TeamMemoryAtHand } from '@memory/application/services/team-memory-at-hand.service';
import { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { WorkMemoryDrafts } from '@memory/application/services/work-memory-drafts.service';
import { MEMORY_EVENT_TYPES } from '@memory/domain/event-types';
import { People } from '@memory/infrastructure/acl/people.adapter';
import { Reviews } from '@memory/infrastructure/acl/reviews.adapter';
import { Work } from '@memory/infrastructure/acl/work.adapter';
import { OpenRouterMemoryDrafter } from '@memory/infrastructure/drafting/openrouter-memory.drafter';
import { DrizzleKnownMemories } from '@memory/infrastructure/persistence/drizzle/repositories/known-memories.reader';
import { DrizzleMemoryRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory.repository';
import { DrizzleMemoryDraftRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory-draft.repository';
import { DrizzleMemoryUses } from '@memory/infrastructure/persistence/drizzle/repositories/memory-uses.ledger';
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
import { EventTypes } from '@platform/events/event-types';
import { OwedWorkWorker } from '@platform/workers/owed-work.worker';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
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
  {
    provide: TEAM_MEMORIES,
    inject: [DrizzleMemoryRepository, MEMORY_USES],
    useFactory: (memories: DrizzleMemoryRepository, uses: MemoryUsesPort) =>
      new MemoriesForBriefing(memories, uses),
  },
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
    provide: TeamMemoryAtHand,
    inject: [PEOPLE, DrizzleMemoryRepository, WORK],
    useFactory: (
      people: PeoplePort,
      memories: DrizzleMemoryRepository,
      work: WorkPort,
    ) => new TeamMemoryAtHand(people, memories, work),
  },
  { provide: MEMORY_USES, useClass: DrizzleMemoryUses },
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
    provide: NoteMemoryUses,
    inject: [MEMORY_USES, WORK, DrizzleMemoryRepository, CLOCK],
    useFactory: (
      uses: MemoryUsesPort,
      work: WorkPort,
      memories: DrizzleMemoryRepository,
      clock: ClockPort,
    ) => new NoteMemoryUses(uses, work, memories, clock),
  },
  ...bindQueryHandler(ReadMemoryFilesQuery, ReadMemoryFilesHandler, [
    RunnerMemoryAtHand,
    DrizzleMemoryRepository,
    WORK,
    PEOPLE,
  ]),
  ...bindCommandHandler(WriteMemoryCommand, WriteMemoryHandler, [
    TeamMemoryAtHand,
    DrizzleMemoryRepository,
    TeamMemoryViews,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(EditMemoryCommand, EditMemoryHandler, [
    TeamMemoryAtHand,
    DrizzleMemoryRepository,
    TeamMemoryViews,
    TRANSACTION,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(RetireMemoryCommand, RetireMemoryHandler, [
    TeamMemoryAtHand,
    DrizzleMemoryRepository,
    TeamMemoryViews,
    TRANSACTION,
    CLOCK,
  ]),
  ...bindQueryHandler(ListTeamMemoriesQuery, ListTeamMemoriesHandler, [
    TeamMemoryAtHand,
    DrizzleMemoryRepository,
    TeamMemoryViews,
  ]),
  ...bindQueryHandler(ReadRunMemoriesQuery, ReadRunMemoriesHandler, [
    TeamMemoryAtHand,
    WORK,
    DrizzleMemoryRepository,
    DrizzleMemoryDraftRepository,
    MEMORY_USES,
    MemoryReviews,
    TeamMemoryViews,
  ]),
  ...bindQueryHandler(ReadTeamMemoryQuery, ReadTeamMemoryHandler, [
    TeamMemoryAtHand,
    TeamMemoryViews,
  ]),
  ...bindQueryHandler(ReadMemoryReviewQuery, ReadMemoryReviewHandler, [
    MemoryAccess,
    DrizzleMemoryDraftRepository,
    MemoryReviews,
  ]),
  {
    provide: RunnerMemoryAtHand,
    inject: [WORK],
    useFactory: (work: WorkPort) => new RunnerMemoryAtHand(work),
  },
  ...bindCommandHandler(RecallMemoriesCommand, RecallMemoriesHandler, [
    RunnerMemoryAtHand,
    DrizzleMemoryRepository,
    TeamMemoryViews,
    MEMORY_USES,
    CLOCK,
  ]),
  ...bindCommandHandler(RecallMemoryCommand, RecallMemoryHandler, [
    RunnerMemoryAtHand,
    DrizzleMemoryRepository,
    TeamMemoryViews,
    MEMORY_USES,
    CLOCK,
  ]),
  ...bindCommandHandler(RememberCommand, RememberHandler, [
    RunnerMemoryAtHand,
    WORK,
    DrizzleMemoryDraftRepository,
    DrizzleMemoryRepository,
    MemoryReviews,
    TRANSACTION,
    ID_GENERATOR,
    CLOCK,
  ]),
  { provide: KNOWN_MEMORIES, useClass: DrizzleKnownMemories },
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
    provide: ForgetMemoryDraft,
    inject: [DrizzleMemoryDraftRepository],
    useFactory: (drafts: DrizzleMemoryDraftRepository) =>
      new ForgetMemoryDraft(drafts),
  },
  {
    provide: WorkMemoryDrafts,
    inject: [
      DrizzleMemoryDraftRepository,
      WORK,
      KNOWN_MEMORIES,
      MEMORY_DRAFTER,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      drafts: DrizzleMemoryDraftRepository,
      work: WorkPort,
      known: KnownMemoriesPort,
      drafter: MemoryDrafterPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new WorkMemoryDrafts(
        drafts,
        work,
        known,
        drafter,
        ids,
        clock,
        transaction,
        logger,
      ),
  },
  {
    provide: OwedWorkWorker,
    inject: [WorkMemoryDrafts, LOGGER],
    useFactory: (drafts: WorkMemoryDrafts, logger: LoggerPort) =>
      new OwedWorkWorker([drafts], logger),
  },
  {
    provide: MEMORY_EVENTS,
    inject: [
      EventTypes,
      EventSubscribers,
      AskForMemories,
      ForgetMemoryDraft,
      MemoryReactions,
      NoteMemoryUses,
    ],
    useFactory: (
      types: EventTypes,
      subscribers: EventSubscribers,
      asking: AskForMemories,
      forgetting: ForgetMemoryDraft,
      reactions: MemoryReactions,
      noting: NoteMemoryUses,
    ) => {
      types.register('memory', MEMORY_EVENT_TYPES);
      subscribers.register(
        memorySubscribers(asking, forgetting, reactions, noting),
      );
      return true;
    },
  },
];
