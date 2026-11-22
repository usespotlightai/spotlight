import type { MemoryStatus } from '@memory/domain/value-objects/memory-status';
import type {
  UpkeepChange,
  UpkeepFinding,
  UpkeepProposalState,
} from '@memory/domain/value-objects/upkeep-change';

export interface UpkeepMemoryDto {
  readonly id: string;
  readonly handle: string;
  readonly kind: string;
  readonly body: string;
  readonly status: MemoryStatus;
}

export interface UpkeepPersonDto {
  readonly id: string;
  readonly name: string | null;
}

export interface UpkeepProposalDto {
  readonly id: string;
  readonly change: UpkeepChange;
  readonly finding: UpkeepFinding;
  readonly reason: string;
  readonly state: UpkeepProposalState;
  readonly body: string | null;
  readonly memories: readonly UpkeepMemoryDto[];
  readonly decidedBy: UpkeepPersonDto | null;
  readonly decidedAt: string | null;
  readonly inactiveMemories: readonly string[];
}

export interface MemoryUpkeepDto {
  readonly id: string;
  readonly teamId: string;
  readonly sweptAt: string;
  readonly proposals: readonly UpkeepProposalDto[];
}
