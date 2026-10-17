import {
  MEMORY_STATUS_NAMES,
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
    example: 'active',
    description: `After approval, whether it is still active: ${MEMORY_STATUS_NAMES.join(' or ')}`,
  })
  readonly status: string | null;

  constructor(proposal: RunProposalDto) {
    super(proposal);
    this.handle = proposal.handle;
    this.status = proposal.status;
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
    description:
      'What the run looked up with spotlight recall, or read from the memory folder in its workspace',
  })
  readonly recalled: readonly TeamMemoryResponseDto[];

  @ApiProperty({
    type: RunProposalResponseDto,
    isArray: true,
    description: 'What the run proposed, drafted or asked to remember',
  })
  readonly proposed: readonly RunProposalResponseDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'aside_8f2c',
    description:
      'The inbox item where people keep or reject what the run proposed; null where it proposed nothing',
  })
  readonly reviewItemId: string | null;

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
    this.reviewItemId = memories.reviewItemId;
  }
}
