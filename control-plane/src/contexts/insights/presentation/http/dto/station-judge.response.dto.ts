import type { JudgeCalibrationDto } from '@insights/application/dto/judge-calibration.dto';
import type {
  CoverageDto,
  KappaReadingDto,
  TrendPointDto,
} from '@insights/application/dto/read-model.dto';
import type {
  AgreementDto,
  ClaimAgreementDto,
  ClaimsSourceDto,
  ClaimsSourcePullRequestDto,
  ConfusionDto,
  RubricVersionDto,
  ScoreCountDto,
  StationJudgeDto,
  StationJudgeSettingsDto,
} from '@insights/application/dto/station-judge.dto';
import { KAPPA_READINGS } from '@insights/domain/services/agreement-reading';
import { HIDDEN_REASONS } from '@insights/domain/services/judge-calibration';
import { ApiProperty } from '@nestjs/swagger';

export class JudgeCalibrationResponseDto {
  @ApiProperty({
    description:
      'Whether the judge agrees with people often enough for its verdicts to count',
  })
  readonly qualified: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.71,
    description:
      'Cohen’s kappa of the judge’s pass or fail against people’s, on the current claims',
  })
  readonly agreement: number | null;

  @ApiProperty({
    enum: [...KAPPA_READINGS, null],
    nullable: true,
    description:
      'How strong the kappa is: almost perfect from 0.81, substantial from 0.61, moderate from 0.41, fair from 0.21, slight from 0.01, no better than chance at 0 and below; none without a kappa',
  })
  readonly reading: KappaReadingDto | null;

  @ApiProperty({
    example: 24,
    description:
      'Runs of the current claims with both a judge verdict and people’s',
  })
  readonly pairs: number;

  @ApiProperty({
    example: 10,
    description:
      'Runs with both a judge verdict and people’s that agreement needs before it counts',
  })
  readonly minPairs: number;

  @ApiProperty({ nullable: true, type: Number, example: 0.6 })
  readonly minAgreement: number | null;

  @ApiProperty({
    enum: [...HIDDEN_REASONS, null],
    nullable: true,
    description: 'Why the judge’s verdicts are hidden, where they are',
  })
  readonly hiddenReason: string | null;

  @ApiProperty({
    description:
      'Whether the judge’s verdicts are hidden for a reason other than too few runs with both verdicts',
  })
  readonly failing: boolean;

  constructor(calibration: JudgeCalibrationDto) {
    this.qualified = calibration.qualified;
    this.agreement = calibration.agreement;
    this.reading = calibration.reading;
    this.pairs = calibration.pairs;
    this.minPairs = calibration.minPairs;
    this.minAgreement = calibration.minAgreement;
    this.hiddenReason = calibration.hiddenReason;
    this.failing = calibration.failing;
  }
}

export class StationJudgeSettingsResponseDto {
  @ApiProperty({ description: 'The SHA-256 of the station’s current claims' })
  readonly rubricVersion: string;

  @ApiProperty({
    description: 'Whether the judge’s claims can be read',
  })
  readonly readable: boolean;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['The change adds a test that fails without it.'],
    description: 'The claims the judge marks met or not met, in order',
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
    this.readable = judge.readable;
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
      'How strong the kappa is: almost perfect from 0.81, substantial from 0.61, moderate from 0.41, fair from 0.21, slight from 0.01, no better than chance at 0 and below; none without a kappa',
  })
  readonly reading: string | null;

  @ApiProperty({
    description: 'Whether the claim’s kappa is below the minimum agreement',
  })
  readonly belowMinimum: boolean;

  constructor(agreement: ClaimAgreementDto) {
    this.index = agreement.index;
    this.pairs = agreement.pairs;
    this.observed = agreement.observed;
    this.kappa = agreement.kappa;
    this.reading = agreement.reading;
    this.belowMinimum = agreement.belowMinimum;
  }
}

export class AgreementResponseDto {
  @ApiProperty({ example: 24 })
  readonly pairs: number;

  @ApiProperty({
    description:
      'Whether enough runs have both verdicts for the figures below to count',
  })
  readonly measured: boolean;

  @ApiProperty({
    example: 0.3,
    description:
      'How far the pairs are towards the minimum that agreement needs, from 0 to 1',
  })
  readonly pairsProgress: number;

  @ApiProperty({
    example: 21,
    description:
      'Runs where the judge and people gave the same verdict, pass or fail',
  })
  readonly agreed: number;

  @ApiProperty({
    example: 24,
    description: 'Runs compared',
  })
  readonly compared: number;

  @ApiProperty({
    description: 'Whether the kappa is below the minimum agreement',
  })
  readonly belowMinimum: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.83,
    description:
      'The share of pairs where the judge and people gave the same verdict',
  })
  readonly observed: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 0.62 })
  readonly kappa: number | null;

  @ApiProperty({
    enum: [...KAPPA_READINGS, null],
    nullable: true,
    description:
      'How strong the kappa is: almost perfect from 0.81, substantial from 0.61, moderate from 0.41, fair from 0.21, slight from 0.01, no better than chance at 0 and below; none without a kappa',
  })
  readonly reading: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.8,
    description:
      'The F1 score of the judge’s pass against people’s; none where neither passed the run',
  })
  readonly f1: number | null;

  @ApiProperty({
    type: ClaimAgreementResponseDto,
    isArray: true,
    description:
      'How often the judge agrees with people on each claim, from grades only; it does not decide whether the judge is qualified',
  })
  readonly claims: readonly ClaimAgreementResponseDto[];

  constructor(agreement: AgreementDto) {
    this.pairs = agreement.pairs;
    this.measured = agreement.measured;
    this.pairsProgress = agreement.pairsProgress;
    this.agreed = agreement.agreed;
    this.compared = agreement.compared;
    this.belowMinimum = agreement.belowMinimum;
    this.observed = agreement.observed;
    this.kappa = agreement.kappa;
    this.reading = agreement.reading;
    this.f1 = agreement.f1;
    this.claims = agreement.claims.map(
      (each) => new ClaimAgreementResponseDto(each),
    );
  }
}

export class ConfusionResponseDto {
  @ApiProperty({ type: String, isArray: true, example: ['fails', 'passes'] })
  readonly labels: readonly string[];

  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
    example: [
      [5, 2],
      [1, 16],
    ],
    description:
      'Counts of runs, a row for each judge verdict and a column for each verdict people gave',
  })
  readonly cells: readonly (readonly number[])[];

  constructor(confusion: ConfusionDto) {
    this.labels = [...confusion.labels];
    this.cells = confusion.cells.map((row) => [...row]);
  }
}

export class ScoreCountResponseDto {
  @ApiProperty({ example: 'passes' })
  readonly label: string;

  @ApiProperty({
    example: 18,
    description:
      'Runs the judge gave this verdict, among runs with both verdicts',
  })
  readonly judge: number;

  @ApiProperty({
    example: 15,
    description: 'Runs people gave this verdict, among runs with both verdicts',
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
      'The share of the day’s runs the judge passed, or null while this claims version is not the current qualified one',
  })
  readonly judge: number | null;

  @ApiProperty({ example: 3 })
  readonly labelled: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.67,
    description: 'The share of the same runs that people passed',
  })
  readonly people: number | null;

  constructor(point: TrendPointDto) {
    this.day = point.day;
    this.judged = point.judged;
    this.judge = point.judge;
    this.labelled = point.labelled;
    this.people = point.people;
  }
}

export class ClaimsSourcePullRequestResponseDto {
  @ApiProperty({ example: 42 })
  readonly number: number;

  @ApiProperty({ example: 'https://github.com/acme/spotlight-config/pull/42' })
  readonly url: string;

  @ApiProperty({ example: 'Tighten the review claims' })
  readonly title: string;

  constructor(pullRequest: ClaimsSourcePullRequestDto) {
    this.number = pullRequest.number;
    this.url = pullRequest.url;
    this.title = pullRequest.title;
  }
}

export class ClaimsSourceResponseDto {
  @ApiProperty({ example: 'acme/spotlight-config' })
  readonly repository: string;

  @ApiProperty({ example: '3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f' })
  readonly sha: string;

  @ApiProperty({ example: '3f1c9a7' })
  readonly shortSha: string;

  @ApiProperty({
    example:
      'https://github.com/acme/spotlight-config/commit/3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f',
    description: 'The commit on GitHub',
  })
  readonly url: string;

  @ApiProperty({
    type: ClaimsSourcePullRequestResponseDto,
    nullable: true,
    description:
      'The pull request that merged the commit, or the first one that has it; null while none is known',
  })
  readonly pullRequest: ClaimsSourcePullRequestResponseDto | null;

  constructor(source: ClaimsSourceDto) {
    this.repository = source.repository;
    this.sha = source.sha;
    this.shortSha = source.shortSha;
    this.url = source.url;
    this.pullRequest = source.pullRequest
      ? new ClaimsSourcePullRequestResponseDto(source.pullRequest)
      : null;
  }
}

export class RubricVersionResponseDto {
  @ApiProperty()
  readonly rubricVersion: string;

  @ApiProperty({ description: 'Whether these are the station’s claims now' })
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
    description: 'How often each verdict was given, in the confusion’s order',
  })
  readonly distribution: readonly ScoreCountResponseDto[];

  @ApiProperty({
    type: TrendPointResponseDto,
    isArray: true,
    description:
      'Daily pass rates of the judge and of people, the judge’s included while its verdicts are hidden on runs',
  })
  readonly trend: readonly TrendPointResponseDto[];

  @ApiProperty({
    description:
      'Whether enough runs have both verdicts, over more than one day, to draw the trend',
  })
  readonly trendShown: boolean;

  @ApiProperty({
    example: 30,
    description: 'Runs with both verdicts that the trend needs',
  })
  readonly trendMinPairs: number;

  @ApiProperty({ example: '2026-09-20T10:00:00.000Z' })
  readonly firstAt: string;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  readonly lastAt: string;

  @ApiProperty({
    type: ClaimsSourceResponseDto,
    nullable: true,
    description:
      'The first commit that wrote these claims, as its line write named it in Spotlight-Source-Commit; null when no write named one',
  })
  readonly source: ClaimsSourceResponseDto | null;

  constructor(version: RubricVersionDto) {
    this.rubricVersion = version.rubricVersion;
    this.current = version.current;
    this.judged = version.judged;
    this.agreement = new AgreementResponseDto(version.agreement);
    this.confusion = new ConfusionResponseDto(version.confusion);
    this.distribution = version.distribution.map(
      (each) => new ScoreCountResponseDto(each),
    );
    this.trend = version.trend.map((each) => new TrendPointResponseDto(each));
    this.trendShown = version.trendShown;
    this.trendMinPairs = version.trendMinPairs;
    this.firstAt = version.firstAt;
    this.lastAt = version.lastAt;
    this.source = version.source
      ? new ClaimsSourceResponseDto(version.source)
      : null;
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

  constructor(rates: CoverageDto['rates']) {
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

  constructor(coverage: CoverageDto) {
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
      'How the judge agreed with people under each claims version, the latest first',
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
