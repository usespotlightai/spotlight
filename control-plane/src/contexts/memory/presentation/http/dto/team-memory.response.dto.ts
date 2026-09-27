import {
  MEMORY_KIND_NAMES,
  MEMORY_REACH_NAMES,
  MEMORY_SOURCE_NAMES,
} from '@memory/application/dto/memory-review.dto';
import {
  MEMORY_STANDING_NAMES,
  type MemoryLinkDto,
  type MemoryRetirementDto,
  type PersonDto,
  type TeamMemoryDetailDto,
  type TeamMemoryDto,
} from '@memory/application/dto/team-memory.dto';
import {
  MemoryGroundNoteResponseDto,
  MemoryGroundStepResponseDto,
} from '@memory/presentation/http/dto/memory-review.response.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MemoryPersonResponseDto {
  @ApiProperty({ example: 'user_1' })
  readonly id: string;

  @ApiProperty({ nullable: true, type: String, example: 'Maya Chen' })
  readonly name: string | null;

  constructor(person: PersonDto) {
    this.id = person.id;
    this.name = person.name;
  }
}

export class MemoryRetirementResponseDto {
  @ApiProperty({ example: '2026-09-27T10:00:00.000Z' })
  readonly at: string;

  @ApiProperty({
    type: MemoryPersonResponseDto,
    nullable: true,
    description: 'Who retired it; nobody where a newer memory superseded it',
  })
  readonly by: MemoryPersonResponseDto | null;

  @ApiProperty({ nullable: true, type: String })
  readonly reason: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The memory that replaced it',
  })
  readonly supersededBy: string | null;

  constructor(retirement: MemoryRetirementDto) {
    this.at = retirement.at;
    this.by = retirement.by ? new MemoryPersonResponseDto(retirement.by) : null;
    this.reason = retirement.reason;
    this.supersededBy = retirement.supersededBy;
  }
}

export class MemoryGroundsResponseDto {
  @ApiProperty({ example: 'task_1' })
  readonly taskId: string;

  @ApiProperty({ example: 'run_1' })
  readonly runId: string;

  constructor(grounds: { taskId: string; runId: string }) {
    this.taskId = grounds.taskId;
    this.runId = grounds.runId;
  }
}

export class MemoryLinkResponseDto {
  @ApiProperty({ example: 'memory_1' })
  readonly id: string;

  @ApiProperty({ example: 'M-7' })
  readonly handle: string;

  @ApiProperty({ example: 'Name branches after the ticket.' })
  readonly body: string;

  constructor(link: MemoryLinkDto) {
    this.id = link.id;
    this.handle = link.handle;
    this.body = link.body;
  }
}

export class TeamMemoryResponseDto {
  @ApiProperty({ example: 'memory_1' })
  readonly id: string;

  @ApiProperty({
    example: 'M-12',
    description: 'How runs and people name it, as in spotlight recall M-12',
  })
  readonly handle: string;

  @ApiProperty({ enum: MEMORY_KIND_NAMES, example: 'preference' })
  readonly kind: string;

  @ApiProperty({ example: 'Name branches after the ticket.' })
  readonly body: string;

  @ApiProperty({ enum: MEMORY_SOURCE_NAMES, example: 'person' })
  readonly source: string;

  @ApiProperty({ enum: MEMORY_STANDING_NAMES, example: 'stands' })
  readonly standing: string;

  @ApiProperty({ enum: MEMORY_REACH_NAMES, example: 'team' })
  readonly reach: string;

  @ApiProperty({ nullable: true, type: String })
  readonly lineId: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly stationId: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'acme/api' })
  readonly repository: string | null;

  @ApiProperty({ type: String, isArray: true })
  readonly paths: readonly string[];

  @ApiProperty({
    type: MemoryPersonResponseDto,
    description: 'Who approved or wrote it',
  })
  readonly approvedBy: MemoryPersonResponseDto;

  @ApiProperty({ example: '2026-09-27T10:00:00.000Z' })
  readonly approvedAt: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The memory it replaced',
  })
  readonly supersedes: string | null;

  @ApiProperty({ type: MemoryRetirementResponseDto, nullable: true })
  readonly retirement: MemoryRetirementResponseDto | null;

  @ApiProperty({
    type: MemoryGroundsResponseDto,
    nullable: true,
    description: 'The task and run it rests on; none where a person wrote it',
  })
  readonly grounds: MemoryGroundsResponseDto | null;

  @ApiProperty({
    example: 3,
    description: 'How many runs were briefed with it or recalled it',
  })
  readonly runs: number;

  constructor(memory: TeamMemoryDto) {
    this.id = memory.id;
    this.handle = memory.handle;
    this.kind = memory.kind;
    this.body = memory.body;
    this.source = memory.source;
    this.standing = memory.standing;
    this.reach = memory.reach;
    this.lineId = memory.lineId;
    this.stationId = memory.stationId;
    this.repository = memory.repository;
    this.paths = memory.paths;
    this.approvedBy = new MemoryPersonResponseDto(memory.approvedBy);
    this.approvedAt = memory.approvedAt;
    this.supersedes = memory.supersedes;
    this.retirement = memory.retirement
      ? new MemoryRetirementResponseDto(memory.retirement)
      : null;
    this.grounds = memory.grounds
      ? new MemoryGroundsResponseDto(memory.grounds)
      : null;
    this.runs = memory.runs;
  }
}

export class TeamMemoryDetailResponseDto extends TeamMemoryResponseDto {
  @ApiProperty({ type: MemoryGroundStepResponseDto, isArray: true })
  readonly steps: readonly MemoryGroundStepResponseDto[];

  @ApiProperty({ type: MemoryGroundNoteResponseDto, isArray: true })
  readonly notes: readonly MemoryGroundNoteResponseDto[];

  @ApiProperty({ type: MemoryLinkResponseDto, nullable: true })
  readonly superseded: MemoryLinkResponseDto | null;

  @ApiProperty({ type: MemoryLinkResponseDto, nullable: true })
  readonly successor: MemoryLinkResponseDto | null;

  constructor(memory: TeamMemoryDetailDto) {
    super(memory);
    this.steps = memory.steps.map(
      (each) => new MemoryGroundStepResponseDto(each),
    );
    this.notes = memory.notes.map(
      (each) => new MemoryGroundNoteResponseDto(each),
    );
    this.superseded = memory.superseded
      ? new MemoryLinkResponseDto(memory.superseded)
      : null;
    this.successor = memory.successor
      ? new MemoryLinkResponseDto(memory.successor)
      : null;
  }
}

export class WriteMemoryRequestDto {
  @ApiProperty({ enum: MEMORY_KIND_NAMES, example: 'preference' })
  readonly kind!: string;

  @ApiProperty({ example: 'Name branches after the ticket.' })
  readonly body!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'The line it applies to; none for the whole team',
  })
  readonly lineId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'The station of that line it applies to',
  })
  readonly stationId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'acme/api' })
  readonly repository?: string | null;

  @ApiPropertyOptional({ type: String, isArray: true })
  readonly paths?: readonly string[];
}

export class RetireMemoryRequestDto {
  @ApiProperty({
    example: 'The retry worker was removed.',
    description: 'Why it no longer holds',
  })
  readonly reason!: string;
}
