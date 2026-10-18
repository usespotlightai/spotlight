import type {
  AlertMeasure,
  AlertReading,
} from '@insights/domain/value-objects/alert-rule.vo';
import {
  type Better,
  type Delta,
  type DeltaUnit,
  deltaOf,
} from '@insights/domain/value-objects/delta.vo';

const MEASURED: Readonly<
  Record<AlertMeasure, { readonly better: Better; readonly unit: DeltaUnit }>
> = {
  sent_back_rate: { better: 'down', unit: 'points' },
  accepted_rate: { better: 'up', unit: 'points' },
  checks_failed_rate: { better: 'down', unit: 'points' },
  failed_rate: { better: 'down', unit: 'points' },
  merged_rate: { better: 'up', unit: 'points' },
  cost_per_run: { better: 'down', unit: 'percent' },
};

export const alertDeltaOf = (
  measure: AlertMeasure,
  reading: AlertReading,
): Delta | null => deltaOf(reading.value, reading.baseline, MEASURED[measure]);
