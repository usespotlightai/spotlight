import {
  MEMORY_STANDING_NAMES,
  type RunMemoriesDto,
  type RunProposalDto,
} from '@memory/application/dto/team-memory.dto';
import { ProposedMemoryResponseDto } from '@memory/presentation/http/dto/memory-review.response.dto';
import { TeamMemoryResponseDto } from '@memory/presentation/http/dto/team-memory.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class RunProposalResponseDto extends ProposedMemoryResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'M-12',
    description: 'Its handle once approved',
  })
  readonly handle: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'stands',
    description: `Once approved, whether it still stands: ${MEMORY_STANDING_NAMES.join(' or ')}`,
  })
  readonly standing: string | null;

  constructor(proposal: RunProposalDto) {
    super(proposal);
    this.handle = proposal.handle;
    this.standing = proposal.standing;
  }
}

export class RunMemoriesResponseDto {
  @ApiProperty({
    type: TeamMemoryResponseDto,
    isArray: true,
    description: 'What the run was briefed with, in the order it was told',
  })
  readonly briefed: readonly TeamMemoryResponseDto[];

  @ApiProperty({
    type: TeamMemoryResponseDto,
    isArray: true,
    description:
      'What reached the run but was left out of its briefing by the cap, the nearest first',
  })
  readonly cut: readonly TeamMemoryResponseDto[];

  @ApiProperty({
    type: TeamMemoryResponseDto,
    isArray: true,
    description: 'What the run looked up with spotlight recall',
  })
  readonly recalled: readonly TeamMemoryResponseDto[];

  @ApiProperty({
    type: RunProposalResponseDto,
    isArray: true,
    description: 'What the run proposed, drafted or asked to remember',
  })
  readonly proposed: readonly RunProposalResponseDto[];

  constructor(memories: RunMemoriesDto) {
    this.briefed = memories.briefed.map(
      (each) => new TeamMemoryResponseDto(each),
    );
    this.cut = memories.cut.map((each) => new TeamMemoryResponseDto(each));
    this.recalled = memories.recalled.map(
      (each) => new TeamMemoryResponseDto(each),
    );
    this.proposed = memories.proposed.map(
      (each) => new RunProposalResponseDto(each),
    );
  }
}
