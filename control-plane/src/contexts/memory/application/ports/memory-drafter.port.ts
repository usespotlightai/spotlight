import type { ProposedMemory } from '@memory/domain/entities/memory-proposal.entity';
import type {
  ChangedPath,
  EvidenceNote,
  EvidenceStep,
} from '@memory/domain/services/draft-evidence';

export const MEMORY_DRAFTER = Symbol('MEMORY_DRAFTER');

export interface KnownMemory {
  readonly id: string;
  readonly kind: string;
  readonly body: string;
}

export interface MemoryDraftAsk {
  readonly lineName: string;
  readonly stationName: string;
  readonly repositories: readonly string[];
  readonly steps: readonly EvidenceStep[];
  readonly stepsLeftOut: number;
  readonly notes: readonly EvidenceNote[];
  readonly changed: readonly ChangedPath[];
  readonly active: readonly KnownMemory[];
  readonly proposed: readonly KnownMemory[];
  readonly rejected: readonly KnownMemory[];
}

export interface MemoryDrafterPort {
  readonly available: boolean;

  draft(ask: MemoryDraftAsk): Promise<readonly ProposedMemory[]>;
}
