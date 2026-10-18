import type {
  AgreementDto,
  ClaimAgreementDto,
  ConfusionDto,
  RubricVersionDto,
  ScoreCountDto,
  StationJudgeDto,
  StationJudgeSettingsDto,
} from '@insights/application/dto/station-judge.dto';
import {
  CORRELATION_READINGS,
  KAPPA_READINGS,
} from '@insights/domain/services/agreement-reading';
import type {
  AgreementReadings,
  Coverage,
  TrendPoint,
} from '@insights/domain/services/judge-agreement';
import {
  AGREEMENT_MEASURES,
  HIDDEN_REASONS,
  type JudgeCalibration,
} from '@insights/domain/services/judge-calibration';
import { SCORE_KINDS } from '@insights/domain/value-objects/score-scale.vo';
import { ApiProperty } from '@nestjs/swagger';

export class JudgeCalibrationResponseDto {
  @ApiProperty({
    description:
      'Whether the judge agrees with people often enough for its scores to count',
  })
  readonly qualified: boolean;

  @ApiProperty({
    enum: [...AGREEMENT_MEASURES, null],
    nullable: true,
    description:
      'How agreement is measured: Cohen’s kappa for yes or no scores and for claims, Spearman’s correlation for numbers',
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
  readonly minAgreement: number | null;

  @ApiProperty({
    enum: [...HIDDEN_REASONS, null],
    nullable: true,
    description: 'Why the judge’s scores are hidden, where they are',
  })
  readonly hiddenReason: string | null;

  constructor(calibration: JudgeCalibration) {
    this.qualified = calibration.qualified;
    this.measure = calibration.measure;
    this.agreement = calibration.agreement;
    this.pairs = calibration.pairs;
    this.minAgreement = calibration.minAgreement;
    this.hiddenReason = calibration.hiddenReason;
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

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['The change adds a test that fails without it.'],
    description:
      'The claims the judge marks met or unmet, in order; empty where it goes by its rubric',
  })
  readonly claims: readonly string[];

  @ApiProperty({
    example: 1,
    description: 'The share of claims a run must meet to pass, from 0 to 1',
  })
  readonly passThreshold: number;

  @ApiProperty({ example: 0.2 })
  readonly sample: number;

  @ApiProperty({ example: 0.6 })
  readonly minAgreement: number;

  constructor(judge: StationJudgeSettingsDto) {
    this.rubricVersion = judge.rubricVersion;
    this.kind = judge.kind;
    this.claims = [...judge.claims];
    this.passThreshold = judge.passThreshold;
    this.sample = judge.sample;
    this.minAgreement = judge.minAgreement;
  }
}

export class ClaimAgreementResponseDto {
  @ApiProperty({ example: 0, description: 'The claim’s place, from 0' })
  readonly index: number;

  @ApiProperty({
    example: 12,
    description: 'Runs where both the judge and people marked this claim',
  })
  readonly pairs: number;

  @ApiProperty({ nullable: true, type: Number, example: 0.9 })
  readonly observed: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 0.74 })
  readonly kappa: number | null;

  @ApiProperty({
    enum: [...KAPPA_READINGS, null],
    nullable: true,
    description:
      'How strong the kappa is: almost perfect from 0.81, substantial from 0.61, moderate from 0.41, fair to slight from 0, poor below; none without a kappa',
  })
  readonly reading: string | null;

  constructor(agreement: ClaimAgreementDto) {
    this.index = agreement.index;
    this.pairs = agreement.pairs;
    this.observed = agreement.observed;
    this.kappa = agreement.kappa;
    this.reading = agreement.reading;
  }
}

export class AgreementReadingsResponseDto {
  @ApiProperty({
    enum: [...KAPPA_READINGS, null],
    nullable: true,
    description:
      'How strong the kappa is: almost perfect from 0.81, substantial from 0.61, moderate from 0.41, fair to slight from 0, poor below; none without a kappa',
  })
  readonly kappa: string | null;

  @ApiProperty({
    enum: [...CORRELATION_READINGS, null],
    nullable: true,
    description:
      'How strong Pearson’s correlation is: very strong from 0.9, strong from 0.7, moderate from 0.5, weak from 0, inverse below; none without one',
  })
  readonly pearson: string | null;

  @ApiProperty({
    enum: [...CORRELATION_READINGS, null],
    nullable: true,
    description:
      'How strong Spearman’s correlation is: very strong from 0.9, strong from 0.7, moderate from 0.5, weak from 0, inverse below; none without one',
  })
  readonly spearman: string | null;

  constructor(readings: AgreementReadings) {
    this.kappa = readings.kappa;
    this.pearson = readings.pearson;
    this.spearman = readings.spearman;
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
    example: 0.61,
    description:
      'Pearson’s correlation between the two scores, for a judge of numbers; none otherwise or where either side never changes',
  })
  readonly pearson: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.7,
    description: 'The mean absolute difference between the two scores',
  })
  readonly mae: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.9,
    description:
      'The root mean square difference between the two scores, for a judge of numbers',
  })
  readonly rmse: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.8,
    description:
      'The F1 score of the judge’s yes, or met, against people’s, for a judge of yes or no or of claims; none where neither said yes',
  })
  readonly f1: number | null;

  @ApiProperty({ type: AgreementReadingsResponseDto })
  readonly readings: AgreementReadingsResponseDto;

  @ApiProperty({
    type: ClaimAgreementResponseDto,
    isArray: true,
    description:
      'For a judge of claims, how often it agrees with people on each claim; the figures above pool every claim. Empty otherwise',
  })
  readonly claims: readonly ClaimAgreementResponseDto[];

  constructor(agreement: AgreementDto) {
    this.pairs = agreement.pairs;
    this.observed = agreement.observed;
    this.kappa = agreement.kappa;
    this.spearman = agreement.spearman;
    this.pearson = agreement.pearson;
    this.mae = agreement.mae;
    this.rmse = agreement.rmse;
    this.f1 = agreement.f1;
    this.readings = new AgreementReadingsResponseDto(agreement.readings);
    this.claims = agreement.claims.map(
      (each) => new ClaimAgreementResponseDto(each),
    );
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

export class ScoreCountResponseDto {
  @ApiProperty({ example: 'yes' })
  readonly label: string;

  @ApiProperty({
    example: 18,
    description: 'Runs the judge gave this score, among runs with both scores',
  })
  readonly judge: number;

  @ApiProperty({
    example: 15,
    description: 'Runs people gave this score, among runs with both scores',
  })
  readonly people: number;

  constructor(count: ScoreCountDto) {
    this.label = count.label;
    this.judge = count.judge;
    this.people = count.people;
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
      'The judge’s mean score, or null while this rubric version is not the current qualified one',
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

  @ApiProperty({
    type: ScoreCountResponseDto,
    isArray: true,
    description: 'How often each score was given, in the confusion’s order',
  })
  readonly distribution: readonly ScoreCountResponseDto[];

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
    this.distribution = version.distribution.map(
      (each) => new ScoreCountResponseDto(each),
    );
    this.trend = version.trend.map((each) => new TrendPointResponseDto(each));
    this.firstAt = version.firstAt;
    this.lastAt = version.lastAt;
  }
}

export class JudgeCoverageRatesResponseDto {
  @ApiProperty({ nullable: true, type: Number, example: 0.24 })
  readonly both: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 0.12 })
  readonly judgeOnly: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 0.4 })
  readonly peopleOnly: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 0.24 })
  readonly neither: number | null;

  constructor(rates: Coverage['rates']) {
    this.both = rates.both;
    this.judgeOnly = rates.judgeOnly;
    this.peopleOnly = rates.peopleOnly;
    this.neither = rates.neither;
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

  @ApiProperty({
    type: JudgeCoverageRatesResponseDto,
    description: 'Each count as a fraction of the runs',
  })
  readonly rates: JudgeCoverageRatesResponseDto;

  constructor(coverage: Coverage) {
    this.runs = coverage.runs;
    this.both = coverage.both;
    this.judgeOnly = coverage.judgeOnly;
    this.peopleOnly = coverage.peopleOnly;
    this.neither = coverage.neither;
    this.rates = new JudgeCoverageRatesResponseDto(coverage.rates);
  }
}

export class StationJudgeAgreementResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ type: StationJudgeSettingsResponseDto, nullable: true })
  readonly judge: StationJudgeSettingsResponseDto | null;

  @ApiProperty({ type: JudgeCalibrationResponseDto })
  readonly calibration: JudgeCalibrationResponseDto;

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
    this.calibration = new JudgeCalibrationResponseDto(judge.calibration);
    this.versions = judge.versions.map(
      (each) => new RubricVersionResponseDto(each),
    );
    this.coverage = new JudgeCoverageResponseDto(judge.coverage);
  }
}
