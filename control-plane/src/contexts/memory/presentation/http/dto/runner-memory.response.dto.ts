import type { RecalledMemoryDto } from '@memory/application/dto/recalled-memory.dto';
import {
  MemoryProvenanceNoteResponseDto,
  MemoryProvenanceStepResponseDto,
} from '@memory/presentation/http/dto/memory-review.response.dto';
import { TeamMemoryDetailResponseDto } from '@memory/presentation/http/dto/team-memory.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class RecalledMemoryResponseDto extends TeamMemoryDetailResponseDto {
  @ApiProperty({ type: MemoryProvenanceStepResponseDto, isArray: true })
  readonly steps: readonly MemoryProvenanceStepResponseDto[];

  @ApiProperty({ type: MemoryProvenanceNoteResponseDto, isArray: true })
  readonly notes: readonly MemoryProvenanceNoteResponseDto[];

  constructor(memory: RecalledMemoryDto) {
    super(memory);
    this.steps = memory.steps.map(
      (each) => new MemoryProvenanceStepResponseDto(each),
    );
    this.notes = memory.notes.map(
      (each) => new MemoryProvenanceNoteResponseDto(each),
    );
  }
}
