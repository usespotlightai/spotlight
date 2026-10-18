import type {
  MemoryProvenanceNoteDto,
  MemoryProvenanceStepDto,
  PersonDto,
  ProposedMemoryDto,
} from '@memory/application/dto/memory-review.dto';
import { MEMORY_STATUSES } from '@memory/domain/value-objects/memory-status';

export const MEMORY_STATUS_NAMES = MEMORY_STATUSES;

export interface MemoryRetirementDto {
  readonly at: string;
  readonly by: PersonDto | null;
  readonly reason: string | null;
  readonly supersededBy: string | null;
}

interface MemoryProvenanceDto {
  readonly taskId: string;
  readonly runId: string;
}

export interface TeamMemoryDto {
  readonly id: string;
  readonly handle: string;
  readonly kind: string;
  readonly body: string;
  readonly source: string;
  readonly status: string;
  readonly scope: string;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repository: string | null;
  readonly paths: readonly string[];
  readonly approvedBy: PersonDto;
  readonly approvedAt: string;
  readonly supersedes: string | null;
  readonly retirement: MemoryRetirementDto | null;
  readonly provenance: MemoryProvenanceDto | null;
  readonly runs: number;
}

export interface MemoryLinkDto {
  readonly id: string;
  readonly handle: string;
  readonly body: string;
}

export interface TeamMemoryDetailDto extends TeamMemoryDto {
  readonly harness: string | null;
  readonly steps: readonly MemoryProvenanceStepDto[];
  readonly notes: readonly MemoryProvenanceNoteDto[];
  readonly superseded: MemoryLinkDto | null;
  readonly successor: MemoryLinkDto | null;
}

export interface RunProposalDto extends ProposedMemoryDto {
  readonly handle: string | null;
  readonly status: string | null;
}

export interface RunMemoriesDto {
  readonly briefed: readonly TeamMemoryDto[];
  readonly omitted: readonly TeamMemoryDto[];
  readonly recalled: readonly TeamMemoryDto[];
  readonly proposed: readonly RunProposalDto[];
  readonly reviewItemId: string | null;
}
