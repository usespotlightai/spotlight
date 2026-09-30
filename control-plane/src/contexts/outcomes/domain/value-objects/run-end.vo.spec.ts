import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import { endOf } from '@outcomes/domain/outcomes.fake-spec';
import { describe, expect, it } from 'vitest';

describe('RunEnd', () => {
  it('names its config by a 64-character hex fingerprint, or none', () => {
    expect(endOf({ fingerprint: null }).fingerprint).toBeNull();
    expect(() => endOf({ fingerprint: 'not-a-fingerprint' })).toThrow(
      InvalidOutcomeError,
    );
  });

  it('is its station’s first round or a later one', () => {
    expect(() => endOf({ round: 0 })).toThrow(InvalidOutcomeError);
    expect(endOf({ round: 3 }).round).toBe(3);
  });
});
