import type {
  MemoryProvenanceNoteDto,
  MemoryProvenanceStepDto,
} from '@memory/application/dto/memory-review.dto';
import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';

export interface RecalledMemoryDto extends TeamMemoryDetailDto {
  readonly steps: readonly MemoryProvenanceStepDto[];
  readonly notes: readonly MemoryProvenanceNoteDto[];
}
