import { ApiProperty } from '@nestjs/swagger';
import type {
  AlertPointDto,
  AlertThresholdDto,
  StationAlertDto,
} from '@outcomes/application/dto/station-alert.dto';
import { ALERT_MEASURES } from '@outcomes/domain/value-objects/alert-rule.vo';

export class AlertThresholdResponseDto {
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

  constructor(threshold: AlertThresholdDto) {
    this.measure = threshold.measure;
    this.risesBy = threshold.risesBy;
    this.fallsBy = threshold.fallsBy;
    this.above = threshold.above;
    this.below = threshold.below;
    this.over = threshold.over;
  }
}

export class AlertCrossingPointResponseDto {
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

export class StationAlertCrossingResponseDto {
  @ApiProperty({ example: 'alert_1' })
  readonly alertId: string;

  @ApiProperty({ example: 'b0c7e1f4-1a2b-4c3d-9e8f-7a6b5c4d3e2f' })
  readonly lineId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({
    type: AlertThresholdResponseDto,
    description: 'The threshold that was crossed, as set on the station',
  })
  readonly threshold: AlertThresholdResponseDto;

  @ApiProperty({
    example: 0.4,
    description: 'The measure over the last runs when it crossed',
  })
  readonly value: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.2,
    description:
      'The measure over the runs before them, for a threshold that watches a rise or fall',
  })
  readonly baseline: number | null;

  @ApiProperty({ example: 'run_1', description: 'The run that crossed it' })
  readonly runId: string;

  @ApiProperty({ example: 'task_1' })
  readonly taskId: string;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  readonly raisedAt: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'When the station came back within the threshold, if it has',
  })
  readonly recoveredAt: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'USD',
    description: 'The currency a cost threshold is in',
  })
  readonly currency: string | null;

  @ApiProperty({
    type: AlertCrossingPointResponseDto,
    isArray: true,
    description: 'The measure run by run around the crossing, the oldest first',
  })
  readonly series: readonly AlertCrossingPointResponseDto[];

  constructor(alert: StationAlertDto) {
    this.alertId = alert.alertId;
    this.lineId = alert.lineId;
    this.stationId = alert.stationId;
    this.threshold = new AlertThresholdResponseDto(alert.threshold);
    this.value = alert.value;
    this.baseline = alert.baseline;
    this.runId = alert.runId;
    this.taskId = alert.taskId;
    this.raisedAt = alert.raisedAt;
    this.recoveredAt = alert.recoveredAt;
    this.currency = alert.currency;
    this.series = alert.series.map(
      (each) => new AlertCrossingPointResponseDto(each),
    );
  }
}
