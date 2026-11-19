import {
  CHANGE_STACK_STATE_NAMES,
  COHORT_KIND_NAMES,
} from '@change-review/application/dto/change-stack.dto';
import {
  DiffFileResponseDto,
  FileNoteResponseDto,
  LayerRevisionResponseDto,
  RemovedLayerResponseDto,
  StackHunkResponseDto,
} from '@change-review/presentation/http/dto/change-stack.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class PublicLayerQuestionResponseDto {
  @ApiProperty({ example: 'c1.l2.q1' })
  readonly id: string;

  @ApiProperty({
    example: 'What happens when the address is already a member?',
  })
  readonly question: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['h3'],
    description: 'The hunks that show the answer',
  })
  readonly hunks: readonly string[];

  constructor(id: string, question: string, hunks: readonly string[]) {
    this.id = id;
    this.question = question;
    this.hunks = hunks;
  }
}

export class PublicStackLayerResponseDto {
  @ApiProperty({ example: 'c1.l2' })
  readonly id: string;

  @ApiProperty({ example: 'Add the invitation API and emails' })
  readonly title: string;

  @ApiProperty()
  readonly summary: string;

  @ApiProperty({ type: StackHunkResponseDto, isArray: true })
  readonly hunks: readonly StackHunkResponseDto[];

  @ApiProperty({ type: FileNoteResponseDto, isArray: true })
  readonly notes: readonly FileNoteResponseDto[];

  @ApiProperty({ type: PublicLayerQuestionResponseDto, isArray: true })
  readonly questions: readonly PublicLayerQuestionResponseDto[];

  @ApiProperty({ type: LayerRevisionResponseDto, nullable: true })
  readonly revision: LayerRevisionResponseDto | null;

  constructor(
    id: string,
    title: string,
    summary: string,
    hunks: readonly StackHunkResponseDto[],
    notes: readonly FileNoteResponseDto[],
    questions: readonly PublicLayerQuestionResponseDto[],
    revision: LayerRevisionResponseDto | null,
  ) {
    this.id = id;
    this.title = title;
    this.summary = summary;
    this.hunks = hunks;
    this.notes = notes;
    this.questions = questions;
    this.revision = revision;
  }
}

export class PublicStackCohortResponseDto {
  @ApiProperty({ example: 'c1' })
  readonly id: string;

  @ApiProperty({ enum: COHORT_KIND_NAMES })
  readonly kind: 'change' | 'incidental';

  @ApiProperty({ example: 'Team invitations' })
  readonly title: string;

  @ApiProperty()
  readonly intent: string;

  @ApiProperty({ type: PublicStackLayerResponseDto, isArray: true })
  readonly layers: readonly PublicStackLayerResponseDto[];

  constructor(
    id: string,
    kind: 'change' | 'incidental',
    title: string,
    intent: string,
    layers: readonly PublicStackLayerResponseDto[],
  ) {
    this.id = id;
    this.kind = kind;
    this.title = title;
    this.intent = intent;
    this.layers = layers;
  }
}

export class PublicChangeStackResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty({ nullable: true, type: String })
  readonly repository: string | null;

  @ApiProperty({ enum: CHANGE_STACK_STATE_NAMES })
  readonly state: 'generating' | 'ready' | 'failed';

  @ApiProperty({ type: DiffFileResponseDto, isArray: true })
  readonly files: readonly DiffFileResponseDto[];

  @ApiProperty({ type: PublicStackCohortResponseDto, isArray: true })
  readonly cohorts: readonly PublicStackCohortResponseDto[];

  @ApiProperty({
    type: RemovedLayerResponseDto,
    isArray: true,
    description: 'Layers of the previous stack that this stack no longer has',
  })
  readonly removed: readonly RemovedLayerResponseDto[];

  constructor(
    id: string,
    repository: string | null,
    state: 'generating' | 'ready' | 'failed',
    files: readonly DiffFileResponseDto[],
    cohorts: readonly PublicStackCohortResponseDto[],
    removed: readonly RemovedLayerResponseDto[],
  ) {
    this.id = id;
    this.repository = repository;
    this.state = state;
    this.files = files;
    this.cohorts = cohorts;
    this.removed = removed;
  }
}

export class PublicChangeStacksResponseDto {
  @ApiProperty({ type: PublicChangeStackResponseDto, isArray: true })
  readonly stacks: readonly PublicChangeStackResponseDto[];

  constructor(stacks: readonly PublicChangeStackResponseDto[]) {
    this.stacks = stacks;
  }
}
