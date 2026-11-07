import { checkReasonOf } from '@change-review/infrastructure/rendering/check-reason';
import { describe, expect, it } from 'vitest';

describe('checkReasonOf', () => {
  it('says the finished change fails the check', () => {
    expect(checkReasonOf({ skip: null, wholeFailed: true })).toBe(
      'The finished change fails the check. Spotlight didn’t check its layers one by one.',
    );
  });

  it('says why a runner could not check it, in its own words', () => {
    expect(
      checkReasonOf({
        skip: { code: 'setup-failed', detail: 'npm ci: no network' },
        wholeFailed: false,
      }),
    ).toBe(
      'The setup of the checkout failed before the check ran.\n\nnpm ci: no network',
    );
  });

  it('blames nobody in particular where no runner ever claimed it', () => {
    expect(
      checkReasonOf({
        skip: { code: 'queue-timeout', detail: null },
        wholeFailed: false,
      }),
    ).toBe('No runner checked the layers in time.');
  });

  it('says nothing about a check that passed', () => {
    expect(checkReasonOf({ skip: null, wholeFailed: false })).toBeNull();
  });
});
