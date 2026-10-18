import type { DeltaDto } from '@insights/application/dto/insights.dto';
import type { AlertMeasure } from '@insights/domain/value-objects/alert-rule.vo';
import type { InsightsPeriodName } from '@insights/domain/value-objects/insights-period.vo';

export interface AlertRuleDto {
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
  readonly rule: AlertRuleDto;
  readonly value: number;
  readonly baseline: number | null;
  readonly change: DeltaDto | null;
  readonly runId: string;
  readonly taskId: string;
  readonly firedAt: string;
  readonly insightsPeriod: InsightsPeriodName;
  readonly resolvedAt: string | null;
  readonly currency: string | null;
  readonly series: readonly AlertPointDto[];
}
