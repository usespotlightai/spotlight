import {
  CHANGE_STACK_STATE_NAMES,
  COHORT_KIND_NAMES,
  DIFF_FILE_STATUS_NAMES,
  STACK_CHECK_STATE_NAMES,
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

export class StackRangeResponseDto {
  @ApiProperty({ example: 'h3', description: 'The hunk it places' })
  readonly hunk: string;

  @ApiProperty({ nullable: true, type: String })
  readonly summary: string | null;

  constructor(hunk: string, summary: string | null) {
    this.hunk = hunk;
    this.summary = summary;
  }
}

export class LayerDependencyResponseDto {
  @ApiProperty({ example: 'c1.l1' })
  readonly layer: string;

  @ApiProperty({ type: String, isArray: true, example: ['Invitation'] })
  readonly because: readonly string[];

  constructor(layer: string, because: readonly string[]) {
    this.layer = layer;
    this.because = because;
  }
}

export class StackLayerResponseDto {
  @ApiProperty({ example: 'c1.l2' })
  readonly id: string;

  @ApiProperty({ example: 'Add the invitation API and emails' })
  readonly title: string;

  @ApiProperty()
  readonly summary: string;

  @ApiProperty({ type: LayerDependencyResponseDto, isArray: true })
  readonly dependsOn: readonly LayerDependencyResponseDto[];

  @ApiProperty({ type: StackRangeResponseDto, isArray: true })
  readonly ranges: readonly StackRangeResponseDto[];

  constructor(
    id: string,
    title: string,
    summary: string,
    dependsOn: readonly LayerDependencyResponseDto[],
    ranges: readonly StackRangeResponseDto[],
  ) {
    this.id = id;
    this.title = title;
    this.summary = summary;
    this.dependsOn = dependsOn;
    this.ranges = ranges;
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

export class CheckedLayerResponseDto {
  @ApiProperty({ example: 'c1.l2', description: '"whole", or the layer' })
  readonly step: string;

  @ApiProperty()
  readonly passed: boolean;

  @ApiProperty({ description: 'The end of what the check printed' })
  readonly output: string;

  @ApiProperty({ example: 42_000 })
  readonly tookMs: number;

  constructor(step: string, passed: boolean, output: string, tookMs: number) {
    this.step = step;
    this.passed = passed;
    this.output = output;
    this.tookMs = tookMs;
  }
}

export class StackCheckResponseDto {
  @ApiProperty({ example: 'npx tsc --noEmit' })
  readonly command: string;

  @ApiProperty({ enum: STACK_CHECK_STATE_NAMES })
  readonly state: 'waiting' | 'checked' | 'skipped';

  @ApiProperty({ nullable: true, type: String })
  readonly reason: string | null;

  @ApiProperty({ nullable: true, type: CheckedLayerResponseDto })
  readonly whole: CheckedLayerResponseDto | null;

  @ApiProperty({
    type: CheckedLayerResponseDto,
    isArray: true,
    description: 'Each layer checked with the layers before it',
  })
  readonly layers: readonly CheckedLayerResponseDto[];

  constructor(
    command: string,
    state: 'waiting' | 'checked' | 'skipped',
    reason: string | null,
    whole: CheckedLayerResponseDto | null,
    layers: readonly CheckedLayerResponseDto[],
  ) {
    this.command = command;
    this.state = state;
    this.reason = reason;
    this.whole = whole;
    this.layers = layers;
  }
}

export class ChangeStackResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty({ nullable: true, type: String })
  readonly repository: string | null;

  @ApiProperty({ enum: CHANGE_STACK_STATE_NAMES })
  readonly state: 'drafting' | 'ready' | 'failed';

  @ApiProperty({ nullable: true, type: String })
  readonly failure: string | null;

  @ApiProperty()
  readonly draftedAt: string;

  @ApiProperty({ nullable: true, type: String })
  readonly settledAt: string | null;

  @ApiProperty({ type: DiffFileResponseDto, isArray: true })
  readonly files: readonly DiffFileResponseDto[];

  @ApiProperty({ type: StackCohortResponseDto, isArray: true })
  readonly cohorts: readonly StackCohortResponseDto[];

  @ApiProperty({
    nullable: true,
    type: StackCheckResponseDto,
    description:
      'Whether each layer builds on its own, where a check was named',
  })
  readonly check: StackCheckResponseDto | null;

  constructor(
    id: string,
    repository: string | null,
    state: 'drafting' | 'ready' | 'failed',
    failure: string | null,
    draftedAt: string,
    settledAt: string | null,
    files: readonly DiffFileResponseDto[],
    cohorts: readonly StackCohortResponseDto[],
    check: StackCheckResponseDto | null,
  ) {
    this.id = id;
    this.repository = repository;
    this.state = state;
    this.failure = failure;
    this.draftedAt = draftedAt;
    this.settledAt = settledAt;
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
  @ApiProperty({ description: 'The run whose page holds the stack' })
  readonly runId: string;

  @ApiProperty({ nullable: true, type: String })
  readonly repository: string | null;

  @ApiProperty({ enum: CHANGE_STACK_STATE_NAMES })
  readonly state: 'drafting' | 'ready' | 'failed';

  @ApiProperty({ enum: STACK_CHECK_STATE_NAMES, nullable: true })
  readonly checkState: 'waiting' | 'checked' | 'skipped' | null;

  constructor(
    runId: string,
    repository: string | null,
    state: 'drafting' | 'ready' | 'failed',
    checkState: 'waiting' | 'checked' | 'skipped' | null,
  ) {
    this.runId = runId;
    this.repository = repository;
    this.state = state;
    this.checkState = checkState;
  }
}

export class TaskChangeStackResponseDto {
  @ApiProperty({
    nullable: true,
    type: LatestChangeStackResponseDto,
    description: 'The newest change stack drafted for the task, if any',
  })
  readonly latest: LatestChangeStackResponseDto | null;

  constructor(latest: LatestChangeStackResponseDto | null) {
    this.latest = latest;
  }
}
