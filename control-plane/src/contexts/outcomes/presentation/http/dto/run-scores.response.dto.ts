import { ApiProperty } from '@nestjs/swagger';
import type {
  CitationDto,
  CitedHunkDto,
  CitedStepDto,
  GradeDto,
  JudgeReasonDto,
  JudgeScoreDto,
  RunScoresDto,
} from '@outcomes/application/dto/run-scores.dto';
import { CITATION_KINDS } from '@outcomes/domain/value-objects/citation.vo';
import { SCORE_KINDS } from '@outcomes/domain/value-objects/score-scale.vo';
import { JudgeStandingResponseDto } from '@outcomes/presentation/http/dto/station-judge.response.dto';

export class CitedStepResponseDto {
  @ApiProperty({
    example: 12,
    description: 'Where the step sits in the run’s journal',
  })
  readonly index: number;

  @ApiProperty({ nullable: true, type: String, example: 'tool' })
  readonly kind: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'edit' })
  readonly tool: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'What the step says, as the judge read it; none once it is gone',
  })
  readonly text: string | null;

  constructor(step: CitedStepDto) {
    this.index = step.index;
    this.kind = step.kind;
    this.tool = step.tool;
    this.text = step.text;
  }
}

export class CitedHunkResponseDto {
  @ApiProperty({ example: 'api/src/uploads.ts#2' })
  readonly id: string;

  @ApiProperty({ nullable: true, type: String, example: 'api/src/uploads.ts' })
  readonly path: string | null;

  @ApiProperty({ nullable: true, type: String, example: '@@ -10,6 +10,8 @@' })
  readonly header: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['+retry(3)'] })
  readonly lines: readonly string[];

  constructor(hunk: CitedHunkDto) {
    this.id = hunk.id;
    this.path = hunk.path;
    this.header = hunk.header;
    this.lines = [...hunk.lines];
  }
}

export class CitationResponseDto {
  @ApiProperty({ enum: CITATION_KINDS })
  readonly kind: string;

  @ApiProperty({ type: CitedStepResponseDto, nullable: true })
  readonly step: CitedStepResponseDto | null;

  @ApiProperty({ type: CitedHunkResponseDto, nullable: true })
  readonly hunk: CitedHunkResponseDto | null;

  constructor(citation: CitationDto) {
    this.kind = citation.kind;
    this.step = citation.step ? new CitedStepResponseDto(citation.step) : null;
    this.hunk = citation.hunk ? new CitedHunkResponseDto(citation.hunk) : null;
  }
}

export class JudgeReasonResponseDto {
  @ApiProperty({ example: 'It retried the upload inside the request.' })
  readonly text: string;

  @ApiProperty({ type: CitationResponseDto, isArray: true })
  readonly citations: readonly CitationResponseDto[];

  constructor(reason: JudgeReasonDto) {
    this.text = reason.text;
    this.citations = reason.citations.map(
      (each) => new CitationResponseDto(each),
    );
  }
}

export class JudgeScoreResponseDto {
  @ApiProperty({ enum: SCORE_KINDS })
  readonly kind: string;

  @ApiProperty({
    example: 1,
    description: '1 for yes and 0 for no, or a whole number from 1 to 5',
  })
  readonly value: number;

  @ApiProperty({ example: 'yes' })
  readonly label: string;

  @ApiProperty()
  readonly rubricVersion: string;

  @ApiProperty({ example: 'google/gemini-3.8-flash' })
  readonly model: string;

  @ApiProperty({ example: '2026-09-30T10:05:00.000Z' })
  readonly at: string;

  @ApiProperty({ type: JudgeReasonResponseDto, isArray: true })
  readonly reasons: readonly JudgeReasonResponseDto[];

  constructor(score: JudgeScoreDto) {
    this.kind = score.kind;
    this.value = score.value;
    this.label = score.label;
    this.rubricVersion = score.rubricVersion;
    this.model = score.model;
    this.at = score.at;
    this.reasons = score.reasons.map(
      (each) => new JudgeReasonResponseDto(each),
    );
  }
}

export class GradeResponseDto {
  @ApiProperty({ example: 'user_ada' })
  readonly by: string;

  @ApiProperty({ description: 'Whether the caller gave this grade' })
  readonly mine: boolean;

  @ApiProperty({ enum: SCORE_KINDS })
  readonly kind: string;

  @ApiProperty({ example: 1 })
  readonly value: number;

  @ApiProperty({ example: 'yes' })
  readonly label: string;

  @ApiProperty({ example: '2026-09-30T11:00:00.000Z' })
  readonly at: string;

  constructor(grade: GradeDto) {
    this.by = grade.by;
    this.mine = grade.mine;
    this.kind = grade.kind;
    this.value = grade.value;
    this.label = grade.label;
    this.at = grade.at;
  }
}

export class RunScoresResponseDto {
  @ApiProperty({ example: '4e1e84a2-0c39-406d-bbbb-559f29e450be' })
  readonly runId: string;

  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly taskId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({
    enum: SCORE_KINDS,
    description:
      'The scale the run is graded on: its judge’s, else its station’s rubric’s, else yes or no',
  })
  readonly kind: string;

  @ApiProperty({ description: 'Whether the judge scored the run' })
  readonly judged: boolean;

  @ApiProperty({
    type: JudgeScoreResponseDto,
    nullable: true,
    description:
      'The judge’s score and its reasons; none where it did not score the run, or where its scores are hidden',
  })
  readonly judge: JudgeScoreResponseDto | null;

  @ApiProperty({ type: JudgeStandingResponseDto })
  readonly standing: JudgeStandingResponseDto;

  @ApiProperty({
    type: GradeResponseDto,
    isArray: true,
    description: 'What people graded the run, the latest first',
  })
  readonly grades: readonly GradeResponseDto[];

  constructor(scores: RunScoresDto) {
    this.runId = scores.runId;
    this.taskId = scores.taskId;
    this.stationId = scores.stationId;
    this.kind = scores.kind;
    this.judged = scores.judged;
    this.judge = scores.judge ? new JudgeScoreResponseDto(scores.judge) : null;
    this.standing = new JudgeStandingResponseDto(scores.standing);
    this.grades = scores.grades.map((each) => new GradeResponseDto(each));
  }
}

export class GradeRunRequestDto {
  @ApiProperty({
    oneOf: [{ type: 'boolean' }, { type: 'integer', minimum: 1, maximum: 5 }],
    example: true,
    description: 'Yes or no, or a whole number from 1 to 5, on the run’s scale',
  })
  readonly value!: boolean | number;
}
