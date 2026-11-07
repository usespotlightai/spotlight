import { stackCheckReasonText } from '@change-review/presentation/http/mappers/stack-check-reason.text';
import { describe, expect, it } from 'vitest';

describe('stackCheckReasonText', () => {
  it('says the finished change fails the check', () => {
    expect(stackCheckReasonText({ skip: null, wholeFailed: true })).toBe(
      'The finished change fails the check. Spotlight didn’t check its layers one by one.',
    );
  });

  it('says why a runner could not check it, in its own words', () => {
    expect(
      stackCheckReasonText({
        skip: { code: 'setup-failed', detail: 'npm ci: no network' },
        wholeFailed: false,
      }),
    ).toBe(
      'The setup of the checkout failed before the check ran.\n\nnpm ci: no network',
    );
  });

  it('blames nobody in particular where no runner ever claimed it', () => {
    expect(
      stackCheckReasonText({
        skip: { code: 'queue-timeout', detail: null },
        wholeFailed: false,
      }),
    ).toBe('No runner checked the layers in time.');
  });

  it('says nothing about a check that passed', () => {
    expect(stackCheckReasonText({ skip: null, wholeFailed: false })).toBeNull();
  });
});
