import type {
  CitationDto,
  CitedHunkDto,
  CitedStepDto,
  JudgeReasonDto,
  JudgeScoreDto,
  RunScoresDto,
} from '@insights/application/dto/run-scores.dto';
import { CITATION_KINDS } from '@insights/domain/value-objects/citation.vo';
import { LABEL_SOURCES } from '@insights/domain/value-objects/label-source';
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
  @ApiProperty({
    type: String,
    isArray: true,
    description: 'The claims the judge checked, in order',
  })
  readonly claims: readonly string[];

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

  @ApiProperty()
  readonly rubricVersion: string;

  @ApiProperty({ example: 'google/gemini-3.8-flash' })
  readonly model: string;

  @ApiProperty({ example: '2026-09-30T10:05:00.000Z' })
  readonly at: string;

  @ApiProperty({ type: JudgeReasonResponseDto, isArray: true })
  readonly reasons: readonly JudgeReasonResponseDto[];

  constructor(score: JudgeScoreDto) {
    this.claims = [...score.claims];
    this.value = score.value;
    this.claimResults = [...score.claimResults];
    this.passes = score.passes;
    this.rubricVersion = score.rubricVersion;
    this.model = score.model;
    this.at = score.at;
    this.reasons = score.reasons.map(
      (each) => new JudgeReasonResponseDto(each),
    );
  }
}

export class RunScoresResponseDto {
  @ApiProperty({ example: '4e1e84a2-0c39-406d-bbbb-559f29e450be' })
  readonly runId: string;

  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly taskId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

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
    enum: [...LABEL_SOURCES, null],
    nullable: true,
    description:
      'What gave people’s verdict on the run: the first action of a person on it, or the merge of the task’s pull request, which counts only for the station’s last completed run on the task. Null where people said nothing yet',
  })
  readonly labelFrom: string | null;

  @ApiProperty({
    type: Boolean,
    nullable: true,
    description:
      'Whether the judge’s verdict is people’s verdict; none where the judge’s verdict is hidden or people said nothing yet',
  })
  readonly agrees: boolean | null;

  constructor(scores: RunScoresDto) {
    this.runId = scores.runId;
    this.taskId = scores.taskId;
    this.stationId = scores.stationId;
    this.judged = scores.judged;
    this.judge = scores.judge ? new JudgeScoreResponseDto(scores.judge) : null;
    this.calibration = new JudgeCalibrationResponseDto(scores.calibration);
    this.labelFrom = scores.labelFrom;
    this.agrees = scores.agrees;
  }
}
