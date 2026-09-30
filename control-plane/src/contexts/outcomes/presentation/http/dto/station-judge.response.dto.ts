import { ApiProperty } from '@nestjs/swagger';
import type {
  AgreementDto,
  ConfusionDto,
  RubricVersionDto,
  StationJudgeDto,
  StationJudgeSettingsDto,
} from '@outcomes/application/dto/station-judge.dto';
import type {
  Coverage,
  TrendPoint,
} from '@outcomes/domain/services/judge-agreement';
import {
  AGREEMENT_MEASURES,
  HIDING_REASONS,
  type JudgeStanding,
} from '@outcomes/domain/services/judge-standing';
import { SCORE_KINDS } from '@outcomes/domain/value-objects/score-scale.vo';

export class JudgeStandingResponseDto {
  @ApiProperty({
    description:
      'Whether the judge agrees with people often enough for its scores to count',
  })
  readonly trusted: boolean;

  @ApiProperty({
    enum: [...AGREEMENT_MEASURES, null],
    nullable: true,
    description:
      'How agreement is measured: Cohen’s kappa for yes or no scores, Spearman’s correlation for numbers',
  })
  readonly measure: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 0.71 })
  readonly agreement: number | null;

  @ApiProperty({
    example: 24,
    description:
      'Runs of the current rubric with both a judge score and people’s',
  })
  readonly pairs: number;

  @ApiProperty({ nullable: true, type: Number, example: 0.6 })
  readonly trust: number | null;

  @ApiProperty({
    enum: [...HIDING_REASONS, null],
    nullable: true,
    description: 'Why the judge’s scores are hidden, where they are',
  })
  readonly hiddenBecause: string | null;

  constructor(standing: JudgeStanding) {
    this.trusted = standing.trusted;
    this.measure = standing.measure;
    this.agreement = standing.agreement;
    this.pairs = standing.pairs;
    this.trust = standing.trust;
    this.hiddenBecause = standing.hiddenBecause;
  }
}

export class StationJudgeSettingsResponseDto {
  @ApiProperty({ description: 'The SHA-256 of the station’s current rubric' })
  readonly rubricVersion: string;

  @ApiProperty({
    enum: [...SCORE_KINDS, null],
    nullable: true,
    description: 'The scale its rubric scores on; none where it cannot be read',
  })
  readonly kind: string | null;

  @ApiProperty({ example: 0.2 })
  readonly sample: number;

  @ApiProperty({ example: 0.6 })
  readonly trust: number;

  constructor(judge: StationJudgeSettingsDto) {
    this.rubricVersion = judge.rubricVersion;
    this.kind = judge.kind;
    this.sample = judge.sample;
    this.trust = judge.trust;
  }
}

export class AgreementResponseDto {
  @ApiProperty({ example: 24 })
  readonly pairs: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.83,
    description:
      'The share of pairs where the judge and people gave the same score',
  })
  readonly observed: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 0.62 })
  readonly kappa: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 0.58 })
  readonly spearman: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.7,
    description: 'The mean absolute difference between the two scores',
  })
  readonly mae: number | null;

  constructor(agreement: AgreementDto) {
    this.pairs = agreement.pairs;
    this.observed = agreement.observed;
    this.kappa = agreement.kappa;
    this.spearman = agreement.spearman;
    this.mae = agreement.mae;
  }
}

export class ConfusionResponseDto {
  @ApiProperty({ type: String, isArray: true, example: ['no', 'yes'] })
  readonly labels: readonly string[];

  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
    example: [
      [5, 2],
      [1, 16],
    ],
    description:
      'Counts of runs, a row for each judge score and a column for each score people gave',
  })
  readonly cells: readonly (readonly number[])[];

  constructor(confusion: ConfusionDto) {
    this.labels = [...confusion.labels];
    this.cells = confusion.cells.map((row) => [...row]);
  }
}

export class TrendPointResponseDto {
  @ApiProperty({ example: '2026-09-30' })
  readonly day: string;

  @ApiProperty({ example: 4 })
  readonly judged: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.75,
    description:
      'The judge’s mean score, or null while this rubric version is not the current trusted one',
  })
  readonly judge: number | null;

  @ApiProperty({ example: 3 })
  readonly labelled: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.67,
    description: 'The mean of people’s scores for the same runs',
  })
  readonly people: number | null;

  constructor(point: TrendPoint) {
    this.day = point.day;
    this.judged = point.judged;
    this.judge = point.judge;
    this.labelled = point.labelled;
    this.people = point.people;
  }
}

export class RubricVersionResponseDto {
  @ApiProperty()
  readonly rubricVersion: string;

  @ApiProperty({ enum: SCORE_KINDS })
  readonly kind: string;

  @ApiProperty({ description: 'Whether this is the station’s rubric now' })
  readonly current: boolean;

  @ApiProperty({ example: 30 })
  readonly judged: number;

  @ApiProperty({ type: AgreementResponseDto })
  readonly agreement: AgreementResponseDto;

  @ApiProperty({ type: ConfusionResponseDto })
  readonly confusion: ConfusionResponseDto;

  @ApiProperty({ type: TrendPointResponseDto, isArray: true })
  readonly trend: readonly TrendPointResponseDto[];

  @ApiProperty({ example: '2026-09-20T10:00:00.000Z' })
  readonly firstAt: string;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  readonly lastAt: string;

  constructor(version: RubricVersionDto) {
    this.rubricVersion = version.rubricVersion;
    this.kind = version.kind;
    this.current = version.current;
    this.judged = version.judged;
    this.agreement = new AgreementResponseDto(version.agreement);
    this.confusion = new ConfusionResponseDto(version.confusion);
    this.trend = version.trend.map((each) => new TrendPointResponseDto(each));
    this.firstAt = version.firstAt;
    this.lastAt = version.lastAt;
  }
}

export class JudgeCoverageResponseDto {
  @ApiProperty({
    example: 50,
    description: 'The station’s latest runs that ran',
  })
  readonly runs: number;

  @ApiProperty({ example: 12 })
  readonly both: number;

  @ApiProperty({ example: 6 })
  readonly judgeOnly: number;

  @ApiProperty({ example: 20 })
  readonly peopleOnly: number;

  @ApiProperty({ example: 12 })
  readonly neither: number;

  constructor(coverage: Coverage) {
    this.runs = coverage.runs;
    this.both = coverage.both;
    this.judgeOnly = coverage.judgeOnly;
    this.peopleOnly = coverage.peopleOnly;
    this.neither = coverage.neither;
  }
}

export class StationJudgeAgreementResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ type: StationJudgeSettingsResponseDto, nullable: true })
  readonly judge: StationJudgeSettingsResponseDto | null;

  @ApiProperty({ type: JudgeStandingResponseDto })
  readonly standing: JudgeStandingResponseDto;

  @ApiProperty({
    type: RubricVersionResponseDto,
    isArray: true,
    description:
      'How the judge agreed with people under each rubric, the latest first',
  })
  readonly versions: readonly RubricVersionResponseDto[];

  @ApiProperty({ type: JudgeCoverageResponseDto })
  readonly coverage: JudgeCoverageResponseDto;

  constructor(judge: StationJudgeDto) {
    this.stationId = judge.stationId;
    this.judge = judge.judge
      ? new StationJudgeSettingsResponseDto(judge.judge)
      : null;
    this.standing = new JudgeStandingResponseDto(judge.standing);
    this.versions = judge.versions.map(
      (each) => new RubricVersionResponseDto(each),
    );
    this.coverage = new JudgeCoverageResponseDto(judge.coverage);
  }
}
