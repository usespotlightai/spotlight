import type {
  AlertPointDto,
  AlertRuleDto,
  StationAlertDto,
} from '@insights/application/dto/station-alert.dto';
import { ALERT_MEASURES } from '@insights/domain/value-objects/alert-rule.vo';
import { INSIGHTS_PERIODS } from '@insights/domain/value-objects/insights-period.vo';
import {
  DeltaResponseDto,
  deltaResponseOf,
} from '@insights/presentation/http/dto/insights-common.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class AlertRuleResponseDto {
  @ApiProperty({ enum: ALERT_MEASURES })
  readonly measure: string;

  @ApiProperty({ nullable: true, type: Number, example: 0.15 })
  readonly risesBy: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly fallsBy: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly above: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly below: number | null;

  @ApiProperty({ example: 10 })
  readonly over: number;

  constructor(threshold: AlertRuleDto) {
    this.measure = threshold.measure;
    this.risesBy = threshold.risesBy;
    this.fallsBy = threshold.fallsBy;
    this.above = threshold.above;
    this.below = threshold.below;
    this.over = threshold.over;
  }
}

export class AlertFiringPointResponseDto {
  @ApiProperty({ example: 'run_1' })
  readonly runId: string;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  readonly endedAt: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.3,
    description:
      'The measure over the runs up to and including this one, as many as the alert compares; none until there are that many',
  })
  readonly value: number | null;

  constructor(point: AlertPointDto) {
    this.runId = point.runId;
    this.endedAt = point.endedAt;
    this.value = point.value;
  }
}

export class StationAlertFiringResponseDto {
  @ApiProperty({ example: 'alert_1' })
  readonly alertId: string;

  @ApiProperty({ example: 'b0c7e1f4-1a2b-4c3d-9e8f-7a6b5c4d3e2f' })
  readonly lineId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({
    type: AlertRuleResponseDto,
    description: 'The alert rule that fired, as set on the station',
  })
  readonly rule: AlertRuleResponseDto;

  @ApiProperty({
    example: 0.4,
    description: 'The measure over the last runs when the alert fired',
  })
  readonly value: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.2,
    description:
      'The measure over the runs before them, for a condition that watches a rise or fall',
  })
  readonly baseline: number | null;

  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description:
      'The measure against the baseline: points for a rate, percent for cost per run; none without a baseline',
  })
  readonly change: DeltaResponseDto | null;

  @ApiProperty({
    example: 'run_1',
    description: 'The run that fired the alert',
  })
  readonly runId: string;

  @ApiProperty({ example: 'task_1' })
  readonly taskId: string;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  readonly firedAt: string;

  @ApiProperty({
    enum: INSIGHTS_PERIODS,
    example: '7d',
    description:
      'The shortest Insights period whose days include the moment the alert fired',
  })
  readonly insightsPeriod: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'When the alert resolved, if it has',
  })
  readonly resolvedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'USD',
    description: 'The currency a cost threshold is in',
  })
  readonly currency: string | null;

  @ApiProperty({
    type: AlertFiringPointResponseDto,
    isArray: true,
    description: 'The measure run by run around the firing, the oldest first',
  })
  readonly series: readonly AlertFiringPointResponseDto[];

  constructor(alert: StationAlertDto) {
    this.alertId = alert.alertId;
    this.lineId = alert.lineId;
    this.stationId = alert.stationId;
    this.rule = new AlertRuleResponseDto(alert.rule);
    this.value = alert.value;
    this.baseline = alert.baseline;
    this.change = deltaResponseOf(alert.change);
    this.runId = alert.runId;
    this.taskId = alert.taskId;
    this.firedAt = alert.firedAt;
    this.insightsPeriod = alert.insightsPeriod;
    this.resolvedAt = alert.resolvedAt;
    this.currency = alert.currency;
    this.series = alert.series.map(
      (each) => new AlertFiringPointResponseDto(each),
    );
  }
}
