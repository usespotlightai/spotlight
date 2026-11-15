import type {
  CitationDto,
  CitedHunkDto,
  CitedStepDto,
  GradeDto,
  JudgeReasonDto,
  JudgeScoreDto,
  RunOutcomeDto,
  RunScoresDto,
} from '@insights/application/dto/run-scores.dto';
import { LABEL_SOURCES } from '@insights/domain/services/human-label';
import { CITATION_KINDS } from '@insights/domain/value-objects/citation.vo';
import { JudgeCalibrationResponseDto } from '@insights/presentation/http/dto/station-judge.response.dto';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 0,
    description:
      'The place of the claim this reason is about, from 0; none only on a reason that names no claim',
  })
  readonly claim: number | null;

  constructor(reason: JudgeReasonDto) {
    this.text = reason.text;
    this.claim = reason.claim;
    this.citations = reason.citations.map(
      (each) => new CitationResponseDto(each),
    );
  }
}

export class JudgeScoreResponseDto {
  @ApiProperty({ example: 0.5, description: 'The share of claims met' })
  readonly value: number;

  @ApiProperty({
    type: Boolean,
    isArray: true,
    example: [true, false],
    description: 'Whether each claim was met, in order',
  })
  readonly claimResults: readonly boolean[];

  @ApiProperty({
    description:
      'Whether the run passes: the share of claims met reaches the pass threshold',
  })
  readonly passes: boolean;

  @ApiProperty({ example: '1 of 2 claims met' })
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
    this.value = score.value;
    this.claimResults = [...score.claimResults];
    this.passes = score.passes;
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

  @ApiProperty({ example: 0.5, description: 'The share of claims met' })
  readonly value: number;

  @ApiProperty({
    type: Boolean,
    isArray: true,
    example: [true, false],
    description: 'Whether the person found each claim met, in order',
  })
  readonly claimResults: readonly boolean[];

  @ApiProperty({
    description:
      'Whether the run passes on this grade: the share of claims met reaches the pass threshold',
  })
  readonly passes: boolean;

  @ApiProperty({ example: '1 of 2 claims met' })
  readonly label: string;

  @ApiProperty({ example: '2026-09-30T11:00:00.000Z' })
  readonly at: string;

  constructor(grade: GradeDto) {
    this.by = grade.by;
    this.mine = grade.mine;
    this.value = grade.value;
    this.claimResults = [...grade.claimResults];
    this.passes = grade.passes;
    this.label = grade.label;
    this.at = grade.at;
  }
}

export class RunHumanOutcomeResponseDto {
  @ApiProperty({
    enum: LABEL_SOURCES,
    description:
      'What gave the human outcome: a grade, the first action of a person on the run, or the task’s pull request',
  })
  readonly source: string;

  @ApiProperty({
    description: 'Whether people found the run good',
  })
  readonly passes: boolean;

  constructor(outcome: RunOutcomeDto) {
    this.source = outcome.source;
    this.passes = outcome.passes;
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
    description:
      'Whether the run can be graded: its judge checked it, or its station has a judge with claims',
  })
  readonly gradable: boolean;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', nullable: true },
    description:
      'The claims the run is graded on, in order: the ones the judge marked where it checked the run, else the station judge’s; a claim reads null only where the claims the judge was given are no longer stored; empty where the run cannot be graded',
  })
  readonly claims: readonly (string | null)[];

  @ApiProperty({
    description:
      'Whether the run is graded on claims the station’s judge no longer uses: the judge checked it on earlier claims',
  })
  readonly earlierClaims: boolean;

  @ApiProperty({ description: 'Whether the judge checked the run' })
  readonly judged: boolean;

  @ApiProperty({
    type: JudgeScoreResponseDto,
    nullable: true,
    description:
      'The judge’s verdict and its reasons; none where it did not check the run, or where its verdicts are hidden',
  })
  readonly judge: JudgeScoreResponseDto | null;

  @ApiProperty({ type: JudgeCalibrationResponseDto })
  readonly calibration: JudgeCalibrationResponseDto;

  @ApiProperty({
    type: RunHumanOutcomeResponseDto,
    nullable: true,
    description:
      'What people said of the run: a grade of the judge’s claims version, else their first action on the run, else the task’s pull request; none where people said nothing yet',
  })
  readonly outcome: RunHumanOutcomeResponseDto | null;

  @ApiProperty({
    type: Boolean,
    nullable: true,
    description:
      'Whether the judge’s verdict is the human outcome; none where the judge’s verdict is hidden or people said nothing yet',
  })
  readonly agrees: boolean | null;

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
    this.gradable = scores.gradable;
    this.claims = [...scores.claims];
    this.earlierClaims = scores.earlierClaims;
    this.judged = scores.judged;
    this.judge = scores.judge ? new JudgeScoreResponseDto(scores.judge) : null;
    this.calibration = new JudgeCalibrationResponseDto(scores.calibration);
    this.outcome = scores.outcome
      ? new RunHumanOutcomeResponseDto(scores.outcome)
      : null;
    this.agrees = scores.agrees;
    this.grades = scores.grades.map((each) => new GradeResponseDto(each));
  }
}

export class GradeRunRequestDto {
  @ApiProperty({
    type: Boolean,
    isArray: true,
    example: [true, false],
    description: 'Whether each claim was met, in order',
  })
  readonly claims!: readonly boolean[];
}
