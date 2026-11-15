import { judgeCalibrationOf } from '@insights/application/dto/judge-calibration.dto';
import { MIN_PAIRS } from '@insights/domain/services/judge-calibration';
import { describe, expect, it } from 'vitest';

const calibration = (
  agreement: number | null,
  hiddenReason: 'too-few-pairs' | 'no-agreement' | null = null,
) =>
  judgeCalibrationOf({
    qualified: hiddenReason === null,
    agreement,
    pairs: 24,
    minAgreement: 0.6,
    hiddenReason,
  });

describe('a judge calibration', () => {
  it('reads its kappa in Landis and Koch’s bands', () => {
    expect(calibration(0.63).reading).toBe('substantial');
  });

  it('gives no reading without an agreement', () => {
    expect(calibration(null).reading).toBeNull();
  });

  it('never fails a judge with too few pairs or no agreement, and names the pairs it needs', () => {
    expect(calibration(0.1, 'no-agreement').failing).toBe(false);
    expect(calibration(0.1, 'too-few-pairs').failing).toBe(false);
    expect(calibration(0.9).minPairs).toBe(MIN_PAIRS);
  });
});
