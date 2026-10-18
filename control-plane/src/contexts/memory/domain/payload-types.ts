import { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import { MemoriesUsed } from '@memory/domain/events/memories-used.event';
import { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import { MemoryCreated } from '@memory/domain/events/memory-created.event';
import { MemoryDraftingFailed } from '@memory/domain/events/memory-drafting-failed.event';
import { MemoryDraftingRequested } from '@memory/domain/events/memory-drafting-requested.event';
import { MemoryRetired } from '@memory/domain/events/memory-retired.event';
import { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryDrafting } from '@memory/domain/value-objects/memory-drafting.vo';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryRetirement } from '@memory/domain/value-objects/memory-retirement.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { RecallWords } from '@memory/domain/value-objects/recall-words.vo';

export const MEMORY_PAYLOAD_TYPES = [
  MemoryDraftId,
  MemoryDrafting,
  MemoryDraftingFailure,
  MemoryProvenance,
  MemoryId,
  MemoryPath,
  MemoryScope,
  MemoriesProposed,
  MemoriesUsed,
  MemoryDraftingRequested,
  MemoryDraftingFailed,
  MemoryApproved,
  MemoryReviewResolved,
  MemoryCreated,
  MemoryRetired,
  MemoryDecision,
  MemoryRetirement,
  MemoryHandle,
  MemoryBody,
  RecallWords,
] as const;
