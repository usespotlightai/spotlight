import { MEMORY_PROPOSAL_STATES } from '@memory/domain/entities/memory-proposal.entity';
import { MEMORY_KINDS } from '@memory/domain/value-objects/memory-kind';
import { MEMORY_REACHES } from '@memory/domain/value-objects/memory-reach';
import { MEMORY_SOURCES } from '@memory/domain/value-objects/memory-source';

export const MEMORY_KIND_NAMES = MEMORY_KINDS;
export const MEMORY_SOURCE_NAMES = MEMORY_SOURCES;
export const MEMORY_STATE_NAMES = MEMORY_PROPOSAL_STATES;
export const MEMORY_REACH_NAMES = MEMORY_REACHES;

export interface MemoryGroundStepDto {
  readonly index: number;
  readonly kind: string;
  readonly text: string;
}

export interface MemoryGroundNoteDto {
  readonly position: number;
  readonly by: string;
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
  readonly state: string;
  readonly reach: string;
  readonly repository: string | null;
  readonly paths: readonly string[];
  readonly supersedes: string | null;
  readonly decision: MemoryDecisionDto | null;
  readonly steps: readonly MemoryGroundStepDto[];
  readonly notes: readonly MemoryGroundNoteDto[];
}

export interface MemoryReviewDto {
  readonly taskId: string;
  readonly runId: string;
  readonly memories: readonly ProposedMemoryDto[];
}
