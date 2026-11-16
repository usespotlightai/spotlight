import {
  claimShareOf,
  claimsPass,
  isPassThreshold,
  passesAt,
} from '@shared-kernel/domain/value-objects/claim-share';
import { describe, expect, it } from 'vitest';

describe('claim share', () => {
  it('counts the share of met claims', () => {
    expect(claimShareOf([true, false, true, true])).toBe(0.75);
  });

  it('passes a share that reaches the threshold within rounding', () => {
    expect(passesAt(claimShareOf([true, true, false]), 2 / 3)).toBe(true);
    expect(passesAt(0.5, 0.6)).toBe(false);
  });

  it('takes a pass threshold above 0, up to 1', () => {
    expect([0.01, 0.5, 1].map(isPassThreshold)).toEqual([true, true, true]);
    expect([0, -0.1, 1.1, Number.NaN].map(isPassThreshold)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('never passes an empty list of claims', () => {
    expect(claimsPass([], 0)).toBe(false);
  });
});
