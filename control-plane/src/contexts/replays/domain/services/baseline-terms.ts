import type { Money } from '@replays/domain/value-objects/money.vo';
import { CALIBRATION_REPEATS } from '@replays/domain/value-objects/replay-repeats';

export interface BaselineTerms {
  readonly calibration: boolean;
  readonly repeats: number;
  readonly ceiling: Money;
}

export const baselineTermsOf = (
  checking: boolean,
  repeats: number,
  ceiling: Money,
): BaselineTerms => {
  if (!checking) {
    return { calibration: false, repeats, ceiling };
  }

  const probing = Math.max(repeats, CALIBRATION_REPEATS);

  return {
    calibration: true,
    repeats: probing,
    ceiling: ceiling.scaledCeiling(probing, repeats),
  };
};
