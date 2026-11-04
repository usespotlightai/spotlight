import { JudgeCalibrationResponseDto } from '@insights/presentation/http/dto/station-judge.response.dto';
import { describe, expect, it } from 'vitest';

const calibration = (
  measure: 'kappa' | 'spearman' | null,
  agreement: number | null,
) =>
  new JudgeCalibrationResponseDto({
    qualified: true,
    measure,
    agreement,
    pairs: 24,
    minAgreement: 0.6,
    hiddenReason: null,
  });

describe('a judge calibration in a response', () => {
  it('reads kappa on the kappa scale and Spearman’s on the correlation scale', () => {
    expect(calibration('kappa', 0.63).reading).toBe('substantial');
    expect(calibration('spearman', 0.63).reading).toBe('moderate');
  });

  it('gives no reading without an agreement', () => {
    expect(calibration('kappa', null).reading).toBeNull();
    expect(calibration(null, null).reading).toBeNull();
  });
});
