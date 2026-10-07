import type {
  AlertMeasure,
  AlertReading,
} from '@outcomes/domain/value-objects/alert-rule.vo';
import {
  type Better,
  type Change,
  type ChangeUnit,
  changeOf,
} from '@outcomes/domain/value-objects/change.vo';

const MEASURED: Readonly<
  Record<AlertMeasure, { readonly better: Better; readonly unit: ChangeUnit }>
> = {
  sent_back_rate: { better: 'down', unit: 'points' },
  accepted_rate: { better: 'up', unit: 'points' },
  checks_failed_rate: { better: 'down', unit: 'points' },
  failed_rate: { better: 'down', unit: 'points' },
  merged_rate: { better: 'up', unit: 'points' },
  cost_per_run: { better: 'down', unit: 'percent' },
};

export const alertChangeOf = (
  measure: AlertMeasure,
  reading: AlertReading,
): Change | null =>
  changeOf(reading.value, reading.baseline, MEASURED[measure]);
