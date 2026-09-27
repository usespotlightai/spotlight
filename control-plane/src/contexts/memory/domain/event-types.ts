import { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import { MemoryDraftingAsked } from '@memory/domain/events/memory-drafting-asked.event';
import { MemoryDraftingFailed } from '@memory/domain/events/memory-drafting-failed.event';
import { MemoryRetired } from '@memory/domain/events/memory-retired.event';
import { MemoryReviewSettled } from '@memory/domain/events/memory-review-settled.event';
import { MemoryStood } from '@memory/domain/events/memory-stood.event';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryDrafting } from '@memory/domain/value-objects/memory-drafting.vo';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryRetirement } from '@memory/domain/value-objects/memory-retirement.vo';
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
  MemoryApproved,
  MemoryReviewSettled,
  MemoryStood,
  MemoryRetired,
  MemoryDecision,
  MemoryRetirement,
] as const;
