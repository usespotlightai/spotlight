import { judgeCalibrationOf } from '@insights/application/dto/judge-calibration.dto';
import { MIN_PAIRS } from '@insights/domain/services/judge-calibration';
import { describe, expect, it } from 'vitest';

const calibration = (
  measure: 'kappa' | 'spearman' | null,
  agreement: number | null,
  hiddenReason: 'too-few-pairs' | 'no-agreement' | null = null,
) =>
  judgeCalibrationOf({
    qualified: hiddenReason === null,
    measure,
    agreement,
    pairs: 24,
    minAgreement: 0.6,
    hiddenReason,
  });

describe('a judge calibration', () => {
  it('reads kappa on the kappa scale and Spearman’s on the correlation scale', () => {
    expect(calibration('kappa', 0.63).reading).toBe('substantial');
    expect(calibration('spearman', 0.63).reading).toBe('moderate');
  });

  it('gives no reading without an agreement', () => {
    expect(calibration('kappa', null).reading).toBeNull();
    expect(calibration(null, null).reading).toBeNull();
  });

  it('fails only when hidden for a reason other than too few pairs, and names the pairs it needs', () => {
    expect(calibration('kappa', 0.1, 'no-agreement').failing).toBe(true);
    expect(calibration('kappa', 0.1, 'too-few-pairs').failing).toBe(false);
    expect(calibration('kappa', 0.9).minPairs).toBe(MIN_PAIRS);
  });
});
