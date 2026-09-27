import {
  KNOWN_MEMORIES,
  type KnownMemoriesPort,
} from '@memory/application/ports/known-memories.port';
import {
  MEMORY_DRAFTER,
  type MemoryDrafterPort,
} from '@memory/application/ports/memory-drafter.port';
import { WORK, type WorkPort } from '@memory/application/ports/work.port';
import { AskForMemories } from '@memory/application/services/ask-for-memories.service';
import { ForgetMemoryDraft } from '@memory/application/services/forget-memory-draft.service';
import { WorkMemoryDrafts } from '@memory/application/services/work-memory-drafts.service';
import { MEMORY_EVENT_TYPES } from '@memory/domain/event-types';
import { Work } from '@memory/infrastructure/acl/work.adapter';
import { OpenRouterMemoryDrafter } from '@memory/infrastructure/drafting/openrouter-memory.drafter';
import { DrizzleKnownMemories } from '@memory/infrastructure/persistence/drizzle/repositories/known-memories.reader';
import { DrizzleMemoryDraftRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory-draft.repository';
import { memorySubscribers } from '@memory/presentation/events/memory.subscribers';
import type { Provider } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
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
  WORK_LOOKUP,
  type WorkLookupPort,
} from '@work/application/ports/work-lookup.port';

const MEMORY_EVENTS = Symbol('MEMORY_EVENTS');

export const MEMORY_PROVIDERS: readonly Provider[] = [
  {
    provide: WORK,
    inject: [WORK_LOOKUP],
    useFactory: (work: WorkLookupPort) => new Work(work),
  },
  DrizzleMemoryDraftRepository,
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
    inject: [EventTypes, EventSubscribers, AskForMemories, ForgetMemoryDraft],
    useFactory: (
      types: EventTypes,
      subscribers: EventSubscribers,
      asking: AskForMemories,
      forgetting: ForgetMemoryDraft,
    ) => {
      types.register('memory', MEMORY_EVENT_TYPES);
      subscribers.register(memorySubscribers(asking, forgetting));
      return true;
    },
  },
];
