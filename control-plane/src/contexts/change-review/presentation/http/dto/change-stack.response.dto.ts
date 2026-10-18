import {
  CHANGE_STACK_STATE_NAMES,
  COHORT_KIND_NAMES,
  DIFF_FILE_STATUS_NAMES,
  STACK_CHECK_STATUS_NAMES,
} from '@change-review/application/dto/change-stack.dto';
import { ApiProperty } from '@nestjs/swagger';

export class DiffHunkResponseDto {
  @ApiProperty({ example: 'h3' })
  readonly id: string;

  @ApiProperty({ example: 20 })
  readonly oldStart: number;

  @ApiProperty({ example: 3 })
  readonly oldLines: number;

  @ApiProperty({ example: 21 })
  readonly newStart: number;

  @ApiProperty({ example: 4 })
  readonly newLines: number;

  @ApiProperty({
    description:
      'The hunk as git diff prints it, from its @@ line; empty where the file has no lines to show',
  })
  readonly patch: string;

  constructor(
    id: string,
    oldStart: number,
    oldLines: number,
    newStart: number,
    newLines: number,
    patch: string,
  ) {
    this.id = id;
    this.oldStart = oldStart;
    this.oldLines = oldLines;
    this.newStart = newStart;
    this.newLines = newLines;
    this.patch = patch;
  }
}

export class DiffFileResponseDto {
  @ApiProperty({ example: 'src/invite.ts' })
  readonly path: string;

  @ApiProperty({ nullable: true, type: String })
  readonly previousPath: string | null;

  @ApiProperty({ enum: DIFF_FILE_STATUS_NAMES })
  readonly status: 'added' | 'deleted' | 'modified' | 'renamed';

  @ApiProperty()
  readonly binary: boolean;

  @ApiProperty({ type: DiffHunkResponseDto, isArray: true })
  readonly hunks: readonly DiffHunkResponseDto[];

  constructor(
    path: string,
    previousPath: string | null,
    status: 'added' | 'deleted' | 'modified' | 'renamed',
    binary: boolean,
    hunks: readonly DiffHunkResponseDto[],
  ) {
    this.path = path;
    this.previousPath = previousPath;
    this.status = status;
    this.binary = binary;
    this.hunks = hunks;
  }
}

export class StackHunkResponseDto {
  @ApiProperty({ example: 'h3', description: 'A hunk of the layer' })
  readonly hunk: string;

  constructor(hunk: string) {
    this.hunk = hunk;
  }
}

export class FileNoteResponseDto {
  @ApiProperty({ example: 'src/invite.ts' })
  readonly path: string;

  @ApiProperty({
    example: 'Adds the endpoint admins invite people through.',
    description: 'What changed in the file for this layer, and why',
  })
  readonly note: string;

  constructor(path: string, note: string) {
    this.path = path;
    this.note = note;
  }
}

export class StackLayerResponseDto {
  @ApiProperty({ example: 'c1.l2' })
  readonly id: string;

  @ApiProperty({ example: 'Add the invitation API and emails' })
  readonly title: string;

  @ApiProperty()
  readonly summary: string;

  @ApiProperty({ type: StackHunkResponseDto, isArray: true })
  readonly hunks: readonly StackHunkResponseDto[];

  @ApiProperty({
    type: FileNoteResponseDto,
    isArray: true,
    description:
      'One note per file the layer touches; empty for incidental changes',
  })
  readonly notes: readonly FileNoteResponseDto[];

  constructor(
    id: string,
    title: string,
    summary: string,
    hunks: readonly StackHunkResponseDto[],
    notes: readonly FileNoteResponseDto[],
  ) {
    this.id = id;
    this.title = title;
    this.summary = summary;
    this.hunks = hunks;
    this.notes = notes;
  }
}

export class CheckedStepResponseDto {
  @ApiProperty({
    example: 'whole',
    description: 'The step it ran: whole, or the layer it checked',
  })
  readonly step: string;

  @ApiProperty()
  readonly passed: boolean;

  @ApiProperty({ description: 'The end of what the check printed' })
  readonly output: string;

  @ApiProperty({ example: 41_000 })
  readonly durationMs: number;

  constructor(
    step: string,
    passed: boolean,
    output: string,
    durationMs: number,
  ) {
    this.step = step;
    this.passed = passed;
    this.output = output;
    this.durationMs = durationMs;
  }
}

export class StackCheckResponseDto {
  @ApiProperty({ example: 'npm test' })
  readonly command: string;

  @ApiProperty({ enum: STACK_CHECK_STATUS_NAMES })
  readonly status: (typeof STACK_CHECK_STATUS_NAMES)[number];

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Why it was skipped, where it was',
  })
  readonly reason: string | null;

  @ApiProperty({ type: CheckedStepResponseDto, nullable: true })
  readonly whole: CheckedStepResponseDto | null;

  @ApiProperty({ type: CheckedStepResponseDto, isArray: true })
  readonly layers: readonly CheckedStepResponseDto[];

  constructor(
    command: string,
    status: (typeof STACK_CHECK_STATUS_NAMES)[number],
    reason: string | null,
    whole: CheckedStepResponseDto | null,
    layers: readonly CheckedStepResponseDto[],
  ) {
    this.command = command;
    this.status = status;
    this.reason = reason;
    this.whole = whole;
    this.layers = layers;
  }
}

export class StackCohortResponseDto {
  @ApiProperty({ example: 'c1' })
  readonly id: string;

  @ApiProperty({ enum: COHORT_KIND_NAMES })
  readonly kind: 'change' | 'incidental';

  @ApiProperty({ example: 'Team invitations' })
  readonly title: string;

  @ApiProperty()
  readonly intent: string;

  @ApiProperty({ type: StackLayerResponseDto, isArray: true })
  readonly layers: readonly StackLayerResponseDto[];

  constructor(
    id: string,
    kind: 'change' | 'incidental',
    title: string,
    intent: string,
    layers: readonly StackLayerResponseDto[],
  ) {
    this.id = id;
    this.kind = kind;
    this.title = title;
    this.intent = intent;
    this.layers = layers;
  }
}

export class ChangeStackResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty({ nullable: true, type: String })
  readonly repository: string | null;

  @ApiProperty({ enum: CHANGE_STACK_STATE_NAMES })
  readonly state: 'generating' | 'ready' | 'failed';

  @ApiProperty({ nullable: true, type: String })
  readonly failure: string | null;

  @ApiProperty({ type: DiffFileResponseDto, isArray: true })
  readonly files: readonly DiffFileResponseDto[];

  @ApiProperty({ type: StackCohortResponseDto, isArray: true })
  readonly cohorts: readonly StackCohortResponseDto[];

  @ApiProperty({
    type: StackCheckResponseDto,
    nullable: true,
    description: 'What the check ran and what each step printed',
  })
  readonly check: StackCheckResponseDto | null;

  constructor(
    id: string,
    repository: string | null,
    state: 'generating' | 'ready' | 'failed',
    failure: string | null,
    files: readonly DiffFileResponseDto[],
    cohorts: readonly StackCohortResponseDto[],
    check: StackCheckResponseDto | null,
  ) {
    this.id = id;
    this.repository = repository;
    this.state = state;
    this.failure = failure;
    this.files = files;
    this.cohorts = cohorts;
    this.check = check;
  }
}

export class RunChangeStacksResponseDto {
  @ApiProperty({
    type: ChangeStackResponseDto,
    isArray: true,
    description: 'Newest first',
  })
  readonly stacks: readonly ChangeStackResponseDto[];

  constructor(stacks: readonly ChangeStackResponseDto[]) {
    this.stacks = stacks;
  }
}

export class LatestChangeStackResponseDto {
  @ApiProperty({ description: 'The run whose page shows the stack' })
  readonly runId: string;

  @ApiProperty({ nullable: true, type: String })
  readonly repository: string | null;

  @ApiProperty({ enum: CHANGE_STACK_STATE_NAMES })
  readonly state: 'generating' | 'ready' | 'failed';

  @ApiProperty({ enum: [...STACK_CHECK_STATUS_NAMES, null], nullable: true })
  readonly checkStatus: (typeof STACK_CHECK_STATUS_NAMES)[number] | null;

  @ApiProperty({ example: 335, description: 'Lines added across the stack' })
  readonly added: number;

  @ApiProperty({ example: 11, description: 'Lines removed across the stack' })
  readonly removed: number;

  constructor(
    runId: string,
    repository: string | null,
    state: 'generating' | 'ready' | 'failed',
    checkStatus: (typeof STACK_CHECK_STATUS_NAMES)[number] | null,
    added: number,
    removed: number,
  ) {
    this.runId = runId;
    this.repository = repository;
    this.state = state;
    this.checkStatus = checkStatus;
    this.added = added;
    this.removed = removed;
  }
}

export class NewestChangeStackResponseDto {
  @ApiProperty({
    nullable: true,
    type: LatestChangeStackResponseDto,
    description: 'The newest change stack generated, if any',
  })
  readonly latest: LatestChangeStackResponseDto | null;

  constructor(latest: LatestChangeStackResponseDto | null) {
    this.latest = latest;
  }
}
