import { MEMORY_PROPOSAL_STATES } from '@memory/domain/entities/memory-proposal.entity';
import { MEMORY_KINDS } from '@memory/domain/value-objects/memory-kind';
import { MEMORY_PROPOSERS } from '@memory/domain/value-objects/memory-proposer';
import { MEMORY_SCOPE_LEVELS } from '@memory/domain/value-objects/memory-scope-level';
import { MEMORY_SOURCES } from '@memory/domain/value-objects/memory-source';

export const MEMORY_KIND_NAMES = MEMORY_KINDS;
export const MEMORY_SOURCE_NAMES = MEMORY_SOURCES;
export const MEMORY_PROPOSER_NAMES = MEMORY_PROPOSERS;
export const MEMORY_STATE_NAMES = MEMORY_PROPOSAL_STATES;
export const MEMORY_SCOPE_NAMES = MEMORY_SCOPE_LEVELS;

export interface MemoryProvenanceStepDto {
  readonly index: number;
  readonly kind: string;
  readonly text: string;
}

export interface PersonDto {
  readonly id: string;
  readonly name: string | null;
  readonly image: string | null;
}

export interface MemoryProvenanceNoteDto {
  readonly position: number;
  readonly by: string;
  readonly author: PersonDto | null;
  readonly text: string;
}

export interface MemoryDecisionDto {
  readonly by: string;
  readonly name: string | null;
  readonly at: string;
}

export interface ProposedMemoryDto {
  readonly id: string;
  readonly kind: string;
  readonly body: string;
  readonly source: string;
  readonly proposedBy: string;
  readonly state: string;
  readonly scope: string;
  readonly repository: string | null;
  readonly paths: readonly string[];
  readonly supersedes: string | null;
  readonly decision: MemoryDecisionDto | null;
  readonly harness: string | null;
  readonly steps: readonly MemoryProvenanceStepDto[];
  readonly notes: readonly MemoryProvenanceNoteDto[];
}

export interface MemoryReviewDto {
  readonly taskId: string;
  readonly runId: string;
  readonly memories: readonly ProposedMemoryDto[];
}
