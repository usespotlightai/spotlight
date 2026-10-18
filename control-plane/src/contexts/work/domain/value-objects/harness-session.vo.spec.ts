import { InvalidHarnessSessionError } from '@work/domain/exceptions/invalid-harness-session.error';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { describe, expect, it } from 'vitest';

describe('HarnessSession', () => {
  it('carries whatever the harness called the conversation', () => {
    expect(
      HarnessSession.of('4fa8db28-5cde-4228-8790-c84f68c25b69').value,
    ).toBe('4fa8db28-5cde-4228-8790-c84f68c25b69');
  });

  it('is the same conversation as one named the same way', () => {
    const one = HarnessSession.of('session_1');

    expect(one.equals(HarnessSession.of('session_1'))).toBe(true);
    expect(one.equals(HarnessSession.of('session_2'))).toBe(false);
  });

  it('rejects a blank session', () => {
    expect(() => HarnessSession.of('  ')).toThrow(InvalidHarnessSessionError);
  });

  it('rejects a name no harness would have given', () => {
    expect(() => HarnessSession.of('x'.repeat(201))).toThrow(
      InvalidHarnessSessionError,
    );
  });
});
