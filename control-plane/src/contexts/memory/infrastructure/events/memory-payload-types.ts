import { MemoriesUsed } from '@memory/domain/events/memories-used.event';
import { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import { MemoryCreated } from '@memory/domain/events/memory-created.event';
import { MemoryMerged } from '@memory/domain/events/memory-merged.event';
import { MemoryRetirementApproved } from '@memory/domain/events/memory-retirement-approved.event';
import { MemoryReviewReopened } from '@memory/domain/events/memory-review-reopened.event';
import { MemoryReviewRequested } from '@memory/domain/events/memory-review-requested.event';
import { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import { MemoryUpkeepSettled } from '@memory/domain/events/memory-upkeep-settled.event';
import { MemoryUpkeepSwept } from '@memory/domain/events/memory-upkeep-swept.event';
import { UpkeepProposalApproved } from '@memory/domain/events/upkeep-proposal-approved.event';
import { BriefingAbout } from '@memory/domain/value-objects/briefing-about.vo';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryPredecessor } from '@memory/domain/value-objects/memory-predecessor.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryRetirement } from '@memory/domain/value-objects/memory-retirement.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';

export const MEMORY_PAYLOAD_TYPES = [
  MemoryProposalSetId,
  MemoryProvenance,
  MemoryId,
  MemoryPath,
  MemoryPredecessor,
  MemoryScope,
  MemoryReviewRequested,
  MemoriesUsed,
  MemoryApproved,
  MemoryReviewReopened,
  MemoryReviewResolved,
  MemoryCreated,
  MemoryMerged,
  MemoryRetirementApproved,
  MemoryDecision,
  MemoryRetirement,
  MemoryHandle,
  MemoryBody,
  RecallWords,
  BriefingAbout,
  MemoryUpkeepId,
  UpkeepProposalId,
  MemoryUpkeepSwept,
  MemoryUpkeepSettled,
  UpkeepProposalApproved,
] as const;
