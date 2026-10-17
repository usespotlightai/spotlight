import {
  MEMORY_KIND_NAMES,
  MEMORY_ORIGIN_NAMES,
  MEMORY_REACH_NAMES,
  MEMORY_SOURCE_NAMES,
  MEMORY_STATE_NAMES,
  type MemoryDecisionDto,
  type MemoryGroundNoteDto,
  type MemoryGroundStepDto,
  type MemoryReviewDto,
  type PersonDto,
  type ProposedMemoryDto,
} from '@memory/application/dto/memory-review.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MemoryGroundStepResponseDto {
  @ApiProperty({
    example: 12,
    description: 'The position of the step in its run',
  })
  readonly index: number;

  @ApiProperty({
    example: 'thought',
    description: 'said, thought, planned, handover, or remember',
  })
  readonly kind: string;

  @ApiProperty({ example: 'A queue would need a worker we do not run.' })
  readonly text: string;

  constructor(step: MemoryGroundStepDto) {
    this.index = step.index;
    this.kind = step.kind;
    this.text = step.text;
  }
}

export class MemoryPersonResponseDto {
  @ApiProperty({ example: 'user_1' })
  readonly id: string;

  @ApiProperty({ nullable: true, type: String, example: 'Maya Chen' })
  readonly name: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'https://avatars.githubusercontent.com/u/1',
  })
  readonly image: string | null;

  constructor(person: PersonDto) {
    this.id = person.id;
    this.name = person.name;
    this.image = person.image;
  }
}

export class MemoryGroundNoteResponseDto {
  @ApiProperty({
    example: 4,
    description: 'The position of the note on its task',
  })
  readonly position: number;

  @ApiProperty({
    example: 'person',
    description:
      'person: a teammate signed in to Spotlight; world: someone writing through another tool',
  })
  readonly by: string;

  @ApiProperty({
    type: MemoryPersonResponseDto,
    nullable: true,
    description:
      'The teammate who said it; absent for words from another tool, which carry no author',
  })
  readonly author: MemoryPersonResponseDto | null;

  @ApiProperty({ example: 'Never retry an upload rejected with a 403.' })
  readonly text: string;

  constructor(note: MemoryGroundNoteDto) {
    this.position = note.position;
    this.by = note.by;
    this.author = note.author ? new MemoryPersonResponseDto(note.author) : null;
    this.text = note.text;
  }
}

export class MemoryDecisionResponseDto {
  @ApiProperty({ example: 'user_1' })
  readonly by: string;

  @ApiProperty({ nullable: true, type: String, example: 'Ada Lovelace' })
  readonly name: string | null;

  @ApiProperty({ example: '2026-09-27T10:00:00.000Z' })
  readonly at: string;

  constructor(decision: MemoryDecisionDto) {
    this.by = decision.by;
    this.name = decision.name;
    this.at = decision.at;
  }
}

export class ProposedMemoryResponseDto {
  @ApiProperty({ example: 'memory_1' })
  readonly id: string;

  @ApiProperty({ enum: MEMORY_KIND_NAMES, example: 'correction' })
  readonly kind: string;

  @ApiProperty({
    example: 'Never retry an upload the bucket rejected with a 403.',
  })
  readonly body: string;

  @ApiProperty({
    enum: MEMORY_SOURCE_NAMES,
    example: 'person',
    description:
      'person: only what a teammate said; outside: input the team does not control, approved one at a time; run: anything else',
  })
  readonly source: string;

  @ApiProperty({
    enum: MEMORY_ORIGIN_NAMES,
    example: 'remembered',
    description:
      'drafted: read from the run after it ended; remembered: the agent asked for it with spotlight remember',
  })
  readonly origin: string;

  @ApiProperty({ enum: MEMORY_STATE_NAMES, example: 'proposed' })
  readonly state: string;

  @ApiProperty({
    enum: MEMORY_REACH_NAMES,
    example: 'station',
    description: 'Where it applies: the whole team, its line, or its station',
  })
  readonly reach: string;

  @ApiProperty({ nullable: true, type: String, example: 'acme/api' })
  readonly repository: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['src/uploads.ts'] })
  readonly paths: readonly string[];

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The active memory it replaces after approval',
  })
  readonly supersedes: string | null;

  @ApiProperty({
    type: MemoryDecisionResponseDto,
    nullable: true,
    description: 'Who approved or rejected it, and when',
  })
  readonly decision: MemoryDecisionResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'claude-code',
    description: 'The harness the run whose steps it rests on ran on',
  })
  readonly harness: string | null;

  @ApiProperty({
    type: MemoryGroundStepResponseDto,
    isArray: true,
    description: 'The steps of its run it rests on',
  })
  readonly steps: readonly MemoryGroundStepResponseDto[];

  @ApiProperty({
    type: MemoryGroundNoteResponseDto,
    isArray: true,
    description: 'What people said on the task that it rests on',
  })
  readonly notes: readonly MemoryGroundNoteResponseDto[];

  constructor(memory: ProposedMemoryDto) {
    this.id = memory.id;
    this.kind = memory.kind;
    this.body = memory.body;
    this.source = memory.source;
    this.origin = memory.origin;
    this.state = memory.state;
    this.reach = memory.reach;
    this.repository = memory.repository;
    this.paths = memory.paths;
    this.supersedes = memory.supersedes;
    this.decision = memory.decision
      ? new MemoryDecisionResponseDto(memory.decision)
      : null;
    this.harness = memory.harness;
    this.steps = memory.steps.map(
      (each) => new MemoryGroundStepResponseDto(each),
    );
    this.notes = memory.notes.map(
      (each) => new MemoryGroundNoteResponseDto(each),
    );
  }
}

export class MemoryReviewResponseDto {
  @ApiProperty({ example: 'task_1' })
  readonly taskId: string;

  @ApiProperty({ example: 'run_1' })
  readonly runId: string;

  @ApiProperty({ type: ProposedMemoryResponseDto, isArray: true })
  readonly memories: readonly ProposedMemoryResponseDto[];

  constructor(review: MemoryReviewDto) {
    this.taskId = review.taskId;
    this.runId = review.runId;
    this.memories = review.memories.map(
      (each) => new ProposedMemoryResponseDto(each),
    );
  }
}

export class ApprovedMemoryRequestDto {
  @ApiProperty({ example: 'memory_1' })
  readonly id!: string;

  @ApiPropertyOptional({
    example: 'Never retry an upload the bucket rejected with a 403 or 404.',
    description: 'The memory as it should be, where it was edited',
  })
  readonly body?: string;
}

export class ApproveMemoriesRequestDto {
  @ApiProperty({
    type: ApprovedMemoryRequestDto,
    isArray: true,
    description:
      'The memories to approve; one from outside the team is approved on its own',
  })
  readonly memories!: readonly ApprovedMemoryRequestDto[];
}
