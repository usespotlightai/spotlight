import type {
  AgentConfigOutcomeDto,
  ChangeMarkerDto,
  InsightsAgentConfigsDto,
  InsightsChangesDto,
  StationJudgeCalibrationDto,
} from '@insights/application/dto/insights-changes.dto';
import {
  JUDGE_OMITTED_REASONS,
  OUTCOME_MEASURES,
} from '@insights/domain/services/agent-config-comparison';
import type { JudgeRate } from '@insights/domain/services/judge-rates';
import { RUN_SIZES, type SizeBound } from '@insights/domain/services/run-size';
import {
  DeltaResponseDto,
  deltaResponseOf,
  InsightsPeriodResponseDto,
} from '@insights/presentation/http/dto/insights-common.response.dto';
import { MeasureVerdictResponseDto } from '@insights/presentation/http/dto/measure-verdict.response.dto';
import { ConfigChangeResponseDto } from '@insights/presentation/http/dto/station-config.response.dto';
import { RunTallyResponseDto } from '@insights/presentation/http/dto/station-insights.response.dto';
import { JudgeCalibrationResponseDto } from '@insights/presentation/http/dto/station-judge.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class StationJudgeCalibrationResponseDto extends JudgeCalibrationResponseDto {
  @ApiProperty({ example: 'b0c7e1f4-1a2b-4c3d-9e8f-7a6b5c4d3e2f' })
  readonly lineId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  constructor(calibration: StationJudgeCalibrationDto) {
    super(calibration);
    this.lineId = calibration.lineId;
    this.stationId = calibration.stationId;
  }
}

export class JudgeRateResponseDto {
  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.8,
    description:
      'The judge’s mean score as a share of its scale, from 0 for the lowest to 1 for the highest; none where it judged none of the runs',
  })
  readonly mean: number | null;

  @ApiProperty({ example: 6, description: 'Runs the judge scored' })
  readonly judged: number;

  constructor(rate: JudgeRate) {
    this.mean = rate.mean;
    this.judged = rate.judged;
  }
}

export class ChangeMarkerResponseDto {
  @ApiProperty({ example: 'b0c7e1f4-1a2b-4c3d-9e8f-7a6b5c4d3e2f' })
  readonly lineId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ example: 'a3f9…', description: 'The new station config' })
  readonly fingerprint: string;

  @ApiProperty({
    example: '9b1d…',
    description:
      'The config the station’s previous run that ran a config ran with; a change back to an earlier config is a change too',
  })
  readonly previousFingerprint: string;

  @ApiProperty({
    example: '2026-09-30T10:00:00.000Z',
    description: 'When the first run with the new config started',
  })
  readonly firstRunAt: string;

  @ApiProperty({ example: 'run_1', description: 'That first run' })
  readonly runId: string;

  @ApiProperty({
    type: RunTallyResponseDto,
    description:
      'The station’s runs with the config before, from its config before last changing up to this change, a run that never started placed where it ended; one that failed provisioning counts as a failed run',
  })
  readonly before: RunTallyResponseDto;

  @ApiProperty({
    type: RunTallyResponseDto,
    description:
      'The station’s runs with this config from this change up to the next one, and its runs meant to run this config that never ran it since the change before, even those that ended before this change; one that failed provisioning counts as a failed run',
  })
  readonly after: RunTallyResponseDto;

  @ApiProperty({
    type: MeasureVerdictResponseDto,
    isArray: true,
    description:
      'Each measure over the runs with the config before against the runs with this one, and whether this one did better',
  })
  readonly verdicts: readonly MeasureVerdictResponseDto[];

  @ApiProperty({
    type: JudgeRateResponseDto,
    nullable: true,
    description:
      'The judge’s scores of the runs before, only where the station’s judge is qualified',
  })
  readonly judgeBefore: JudgeRateResponseDto | null;

  @ApiProperty({
    type: JudgeRateResponseDto,
    nullable: true,
    description:
      'The judge’s scores of the runs after, only where the station’s judge is qualified',
  })
  readonly judgeAfter: JudgeRateResponseDto | null;

  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description:
      'The judge’s mean score after against before, in points; none where either side went unjudged',
  })
  readonly judgeChange: DeltaResponseDto | null;

  @ApiProperty({
    type: ConfigChangeResponseDto,
    isArray: true,
    description: 'How the new config differs from the one before it',
  })
  readonly changes: readonly ConfigChangeResponseDto[];

  constructor(marker: ChangeMarkerDto) {
    this.lineId = marker.lineId;
    this.stationId = marker.stationId;
    this.fingerprint = marker.fingerprint;
    this.previousFingerprint = marker.previousFingerprint;
    this.firstRunAt = marker.firstRunAt;
    this.runId = marker.runId;
    this.before = new RunTallyResponseDto(marker.before);
    this.after = new RunTallyResponseDto(marker.after);
    this.verdicts = marker.verdicts.map(
      (each) => new MeasureVerdictResponseDto(each),
    );
    this.judgeBefore = marker.judgeBefore
      ? new JudgeRateResponseDto(marker.judgeBefore)
      : null;
    this.judgeChange = deltaResponseOf(marker.judgeChange);
    this.judgeAfter = marker.judgeAfter
      ? new JudgeRateResponseDto(marker.judgeAfter)
      : null;
    this.changes = marker.changes.map(
      (each) => new ConfigChangeResponseDto(each),
    );
  }
}

export class InsightsChangesResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({
    type: ChangeMarkerResponseDto,
    isArray: true,
    description:
      'Every station config change in the period, the oldest first, with the station’s tally before and after it',
  })
  readonly markers: readonly ChangeMarkerResponseDto[];

  @ApiProperty({
    type: StationJudgeCalibrationResponseDto,
    isArray: true,
    description:
      'The calibration of each changed station’s judge, where it has one',
  })
  readonly judges: readonly StationJudgeCalibrationResponseDto[];

  constructor(changes: InsightsChangesDto) {
    this.period = new InsightsPeriodResponseDto(changes.period);
    this.markers = changes.markers.map(
      (each) => new ChangeMarkerResponseDto(each),
    );
    this.judges = changes.judges.map(
      (each) => new StationJudgeCalibrationResponseDto(each),
    );
  }
}

export class SizeBoundResponseDto {
  @ApiProperty({ enum: RUN_SIZES })
  readonly size: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 50,
    description:
      'The most lines a run’s changes may take out and put in to be this size; none for no limit',
  })
  readonly maxLines: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 20,
    description:
      'For a run that changed no lines, the most steps it may take to be this size; none for no limit',
  })
  readonly maxSteps: number | null;

  constructor(bound: SizeBound) {
    this.size = bound.size;
    this.maxLines = bound.maxLines;
    this.maxSteps = bound.maxSteps;
  }
}

export class AgentConfigOutcomesResponseDto {
  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.6,
    description: 'Share of runs that a person accepted or approved first',
  })
  readonly accepted: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.2,
    description: 'Share of runs that a person sent back or refused first',
  })
  readonly sent_back: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.3,
    description: 'Share of runs that passed their task to another station',
  })
  readonly passed: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.9,
    description: 'Share of checked runs whose checks passed',
  })
  readonly checks_passed: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.5,
    description: 'Share of the runs’ tasks whose pull request merged',
  })
  readonly merged: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.75,
    description:
      'The judge’s mean score as a share of its scale, over runs at stations whose judge is qualified',
  })
  readonly judge: number | null;

  constructor(outcomes: AgentConfigOutcomeDto['outcomes']) {
    this.accepted = outcomes.accepted;
    this.sent_back = outcomes.sent_back;
    this.passed = outcomes.passed;
    this.checks_passed = outcomes.checks_passed;
    this.merged = outcomes.merged;
    this.judge = outcomes.judge;
  }
}

export class AgentConfigOutcomeResponseDto {
  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({ nullable: true, type: String, example: 'sonnet' })
  readonly model: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'high' })
  readonly effort: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'careful' })
  readonly profileKey: string | null;

  @ApiProperty({ type: RunTallyResponseDto })
  readonly tally: RunTallyResponseDto;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.42,
    description:
      'What a priced run cost on average; none where no run was priced or they came in more than one currency',
  })
  readonly costPerRun: number | null;

  @ApiProperty({ nullable: true, type: String, example: 'USD' })
  readonly currency: string | null;

  @ApiProperty({
    description:
      'Whether it has a cost per run in the currency the comparison is drawn in, so it can go on the chart',
  })
  readonly priced: boolean;

  @ApiProperty({ type: AgentConfigOutcomesResponseDto })
  readonly outcomes: AgentConfigOutcomesResponseDto;

  @ApiProperty({
    type: JudgeRateResponseDto,
    nullable: true,
    description:
      'The judge’s scores of this agent config’s runs; none unless the comparison is narrowed to one station',
  })
  readonly judge: JudgeRateResponseDto | null;

  @ApiProperty({
    enum: OUTCOME_MEASURES,
    isArray: true,
    description:
      'The outcomes this agent config sits on the cost frontier for: no other agent config with enough runs did as well or better for less',
  })
  readonly frontier: readonly string[];

  constructor(agentConfig: AgentConfigOutcomeDto) {
    this.harness = agentConfig.harness;
    this.model = agentConfig.model;
    this.effort = agentConfig.effort;
    this.profileKey = agentConfig.profileKey;
    this.tally = new RunTallyResponseDto(agentConfig.tally);
    this.costPerRun = agentConfig.costPerRun;
    this.currency = agentConfig.currency;
    this.priced = agentConfig.priced;
    this.outcomes = new AgentConfigOutcomesResponseDto(agentConfig.outcomes);
    this.judge = agentConfig.judge
      ? new JudgeRateResponseDto(agentConfig.judge)
      : null;
    this.frontier = [...agentConfig.frontier];
  }
}

export class InsightsAgentConfigsResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The station the comparison was narrowed to, if any',
  })
  readonly stationId: string | null;

  @ApiProperty({
    enum: [...RUN_SIZES, null],
    nullable: true,
    description: 'The run size the comparison was narrowed to, if any',
  })
  readonly size: string | null;

  @ApiProperty({
    type: SizeBoundResponseDto,
    isArray: true,
    description:
      'How a run’s size is measured: by the lines its changes removed and added, or by its steps where it changed none',
  })
  readonly sizes: readonly SizeBoundResponseDto[];

  @ApiProperty({
    example: 3,
    description:
      'The minimum number of runs an agent config needs to sit on the frontier',
  })
  readonly minRuns: number;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'USD',
    description:
      'The currency the frontier is drawn in; agent configs priced in another are left off it',
  })
  readonly currency: string | null;

  @ApiProperty({
    type: AgentConfigOutcomeResponseDto,
    isArray: true,
    description:
      'How runs went on each harness, model, effort and profile, the most runs first',
  })
  readonly agentConfigs: readonly AgentConfigOutcomeResponseDto[];

  @ApiProperty({
    enum: [...JUDGE_OMITTED_REASONS, null],
    nullable: true,
    description:
      'Why no judge scores are compared: no_station where the comparison spans stations, whose judges each score against their own rubric',
  })
  readonly judgeOmitted: string | null;

  @ApiProperty({
    type: StationJudgeCalibrationResponseDto,
    isArray: true,
    description:
      'The calibration of the station’s judge, where one station is picked and it has a judge',
  })
  readonly judges: readonly StationJudgeCalibrationResponseDto[];

  constructor(agentConfigs: InsightsAgentConfigsDto) {
    this.period = new InsightsPeriodResponseDto(agentConfigs.period);
    this.stationId = agentConfigs.stationId;
    this.size = agentConfigs.size;
    this.sizes = agentConfigs.sizes.map(
      (each) => new SizeBoundResponseDto(each),
    );
    this.minRuns = agentConfigs.minRuns;
    this.currency = agentConfigs.currency;
    this.agentConfigs = agentConfigs.agentConfigs.map(
      (each) => new AgentConfigOutcomeResponseDto(each),
    );
    this.judgeOmitted = agentConfigs.judgeOmitted;
    this.judges = agentConfigs.judges.map(
      (each) => new StationJudgeCalibrationResponseDto(each),
    );
  }
}
