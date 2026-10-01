import type { AlertMeasure } from '@outcomes/domain/value-objects/alert-rule.vo';

export interface AlertThresholdDto {
  readonly measure: AlertMeasure;
  readonly risesBy: number | null;
  readonly fallsBy: number | null;
  readonly above: number | null;
  readonly below: number | null;
  readonly over: number;
}

export interface AlertPointDto {
  readonly runId: string;
  readonly endedAt: string;
  readonly value: number | null;
}

export interface StationAlertDto {
  readonly alertId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly threshold: AlertThresholdDto;
  readonly value: number;
  readonly baseline: number | null;
  readonly runId: string;
  readonly taskId: string;
  readonly raisedAt: string;
  readonly recoveredAt: string | null;
  readonly currency: string | null;
  readonly series: readonly AlertPointDto[];
}
