import { checkReasonText } from '@change-review/application/rendering/check-reason.text';
import { describe, expect, it } from 'vitest';

describe('checkReasonText', () => {
  it('says the finished change fails the check', () => {
    expect(checkReasonText({ skip: null, wholeFailed: true })).toBe(
      'The finished change fails the check. Spotlight didn’t check its layers one by one.',
    );
  });

  it('says why a runner could not check it, in its own words', () => {
    expect(
      checkReasonText({
        skip: {
          code: 'setup-failed',
          detail: 'npm ci: no network',
          attempts: null,
        },
        wholeFailed: false,
      }),
    ).toBe(
      'The setup of the checkout failed before the check ran.\n\nnpm ci: no network',
    );
  });

  it('blames nobody in particular where no runner ever claimed it', () => {
    expect(
      checkReasonText({
        skip: { code: 'queue-timeout', detail: null, attempts: null },
        wholeFailed: false,
      }),
    ).toBe('No runner checked the layers in time.');
  });

  it('says how often provisioning a runner failed, and the last failure', () => {
    expect(
      checkReasonText({
        skip: {
          code: 'provision-failed',
          detail: 'quota exceeded',
          attempts: 3,
        },
        wholeFailed: false,
      }),
    ).toBe(
      'Spotlight couldn’t provision a runner to check the layers.\n\nAttempts: 3\nLast failure: quota exceeded',
    );
  });

  it('says nothing about a check that passed', () => {
    expect(checkReasonText({ skip: null, wholeFailed: false })).toBeNull();
  });
});
