import { InvalidJudgingFailureError } from '@shared-kernel/domain/exceptions/invalid-judging-failure.error';
import { JudgingFailure } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import { describe, expect, it } from 'vitest';

describe('JudgingFailure', () => {
  const at = new Date('2026-01-01T00:00:00Z');

  it('retries a failed request and an unreadable answer, not missing evidence', () => {
    expect(
      JudgingFailure.of('request-failed', at).retry.nextAttemptAt(1, at),
    ).not.toBeNull();
    expect(
      JudgingFailure.of('unreadable', at).retry.nextAttemptAt(1, at),
    ).not.toBeNull();
    expect(
      JudgingFailure.of('no-evidence', at).retry.nextAttemptAt(1, at),
    ).toBeNull();
  });

  it('knows no code but its own', () => {
    expect(() => JudgingFailure.of('lost', at)).toThrow(
      InvalidJudgingFailureError,
    );
  });
});
