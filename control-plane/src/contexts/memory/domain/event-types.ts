import { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import { MemoryDraftingAsked } from '@memory/domain/events/memory-drafting-asked.event';
import { MemoryDraftingFailed } from '@memory/domain/events/memory-drafting-failed.event';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryDrafting } from '@memory/domain/value-objects/memory-drafting.vo';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';

export const MEMORY_EVENT_TYPES = [
  MemoryDraftId,
  MemoryDrafting,
  MemoryDraftingFailure,
  MemoryGrounds,
  MemoryId,
  MemoryPath,
  MemoryScope,
  MemoriesProposed,
  MemoryDraftingAsked,
  MemoryDraftingFailed,
] as const;
