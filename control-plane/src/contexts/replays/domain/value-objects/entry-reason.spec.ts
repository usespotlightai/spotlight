import { isVerifierReason } from '@replays/domain/value-objects/entry-reason';
import { describe, expect, it } from 'vitest';

describe('isVerifierReason', () => {
  it('names what the judge and the checks said, and nothing around the work', () => {
    expect(isVerifierReason('judged')).toBe(true);
    expect(isVerifierReason('judge-failed')).toBe(true);
    expect(isVerifierReason('check-failed')).toBe(true);
    expect(isVerifierReason('run-failed')).toBe(false);
    expect(isVerifierReason('check-skipped')).toBe(false);
    expect(isVerifierReason('unjudged')).toBe(false);
  });
});
