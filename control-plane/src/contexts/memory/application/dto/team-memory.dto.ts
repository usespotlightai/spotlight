import type {
  MemoryGroundNoteDto,
  MemoryGroundStepDto,
} from '@memory/application/dto/memory-review.dto';
import { MEMORY_STANDINGS } from '@memory/domain/value-objects/memory-standing';

export const MEMORY_STANDING_NAMES = MEMORY_STANDINGS;

export interface PersonDto {
  readonly id: string;
  readonly name: string | null;
}

export interface MemoryRetirementDto {
  readonly at: string;
  readonly by: PersonDto | null;
  readonly reason: string | null;
  readonly supersededBy: string | null;
}

interface MemoryGroundsDto {
  readonly taskId: string;
  readonly runId: string;
}

export interface TeamMemoryDto {
  readonly id: string;
  readonly handle: string;
  readonly kind: string;
  readonly body: string;
  readonly source: string;
  readonly standing: string;
  readonly reach: string;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repository: string | null;
  readonly paths: readonly string[];
  readonly approvedBy: PersonDto;
  readonly approvedAt: string;
  readonly supersedes: string | null;
  readonly retirement: MemoryRetirementDto | null;
  readonly grounds: MemoryGroundsDto | null;
}

export interface MemoryLinkDto {
  readonly id: string;
  readonly body: string;
}

export interface TeamMemoryDetailDto extends TeamMemoryDto {
  readonly steps: readonly MemoryGroundStepDto[];
  readonly notes: readonly MemoryGroundNoteDto[];
  readonly superseded: MemoryLinkDto | null;
  readonly successor: MemoryLinkDto | null;
}
