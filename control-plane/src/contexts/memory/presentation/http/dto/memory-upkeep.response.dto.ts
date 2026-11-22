import type {
  MemoryUpkeepDto,
  UpkeepMemoryDto,
  UpkeepPersonDto,
  UpkeepProposalDto,
} from '@memory/application/dto/memory-upkeep.dto';
import { MEMORY_STATUSES } from '@memory/domain/value-objects/memory-status';
import {
  UPKEEP_CHANGES,
  UPKEEP_FINDINGS,
  UPKEEP_PROPOSAL_STATES,
} from '@memory/domain/value-objects/upkeep-change';
import { ApiProperty } from '@nestjs/swagger';

export class UpkeepMemoryResponseDto {
  @ApiProperty({ example: 'memory_1' })
  readonly id: string;

  @ApiProperty({ example: 'M-12' })
  readonly handle: string;

  @ApiProperty({ example: 'rationale' })
  readonly kind: string;

  @ApiProperty({ example: 'Uploads retry in the request, not from a queue.' })
  readonly body: string;

  @ApiProperty({ enum: MEMORY_STATUSES })
  readonly status: string;

  constructor(memory: UpkeepMemoryDto) {
    this.id = memory.id;
    this.handle = memory.handle;
    this.kind = memory.kind;
    this.body = memory.body;
    this.status = memory.status;
  }
}

export class UpkeepPersonResponseDto {
  @ApiProperty({ example: 'user_1' })
  readonly id: string;

  @ApiProperty({ type: String, nullable: true, example: 'Ada' })
  readonly name: string | null;

  constructor(person: UpkeepPersonDto) {
    this.id = person.id;
    this.name = person.name;
  }
}

export class UpkeepProposalResponseDto {
  @ApiProperty({ example: 'proposal_1' })
  readonly id: string;

  @ApiProperty({
    enum: UPKEEP_CHANGES,
    description:
      'retire ends the memory, merge replaces the memories with one new memory',
  })
  readonly change: string;

  @ApiProperty({ enum: UPKEEP_FINDINGS, description: 'Which check found it' })
  readonly finding: string;

  @ApiProperty({
    example:
      '`src/uploads` no longer exists on the default branch of acme/api.',
  })
  readonly reason: string;

  @ApiProperty({ enum: UPKEEP_PROPOSAL_STATES })
  readonly state: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The body of the memory a merge writes',
  })
  readonly body: string | null;

  @ApiProperty({ type: [UpkeepMemoryResponseDto] })
  readonly memories: UpkeepMemoryResponseDto[];

  @ApiProperty({ type: UpkeepPersonResponseDto, nullable: true })
  readonly decidedBy: UpkeepPersonResponseDto | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readonly decidedAt: string | null;

  @ApiProperty({
    type: [String],
    description:
      'The handles of the memories of an undecided change that are no longer active, so the change no longer applies',
  })
  readonly inactiveMemories: readonly string[];

  constructor(proposal: UpkeepProposalDto) {
    this.id = proposal.id;
    this.change = proposal.change;
    this.finding = proposal.finding;
    this.reason = proposal.reason;
    this.state = proposal.state;
    this.body = proposal.body;
    this.memories = proposal.memories.map(
      (each) => new UpkeepMemoryResponseDto(each),
    );
    this.decidedBy = proposal.decidedBy
      ? new UpkeepPersonResponseDto(proposal.decidedBy)
      : null;
    this.decidedAt = proposal.decidedAt;
    this.inactiveMemories = proposal.inactiveMemories;
  }
}

export class MemoryUpkeepResponseDto {
  @ApiProperty({ example: 'upkeep_1' })
  readonly id: string;

  @ApiProperty({ example: 'team_1' })
  readonly teamId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly sweptAt: string;

  @ApiProperty({ type: [UpkeepProposalResponseDto] })
  readonly proposals: UpkeepProposalResponseDto[];

  constructor(upkeep: MemoryUpkeepDto) {
    this.id = upkeep.id;
    this.teamId = upkeep.teamId;
    this.sweptAt = upkeep.sweptAt;
    this.proposals = upkeep.proposals.map(
      (each) => new UpkeepProposalResponseDto(each),
    );
  }
}
