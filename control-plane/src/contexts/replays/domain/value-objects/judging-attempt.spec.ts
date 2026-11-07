import { judgingPurposeOf } from '@replays/domain/value-objects/judging-attempt';
import { describe, expect, it } from 'vitest';

describe('judgingPurposeOf', () => {
  it('reads the first attempt as the original judging and the second as the calibration rejudging', () => {
    expect(judgingPurposeOf(1)).toBe('original');
    expect(judgingPurposeOf(2)).toBe('calibration');
  });
});
