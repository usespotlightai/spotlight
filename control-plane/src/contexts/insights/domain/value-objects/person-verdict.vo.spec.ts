import { InvalidRunVerdictError } from '@insights/domain/exceptions/invalid-run-verdict.error';
import {
  MAX_VERDICT_REASON_CHARS,
  PersonVerdict,
} from '@insights/domain/value-objects/person-verdict.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const BY = UserId.of('user_ada');
const AT = new Date('2026-09-30T12:00:00.000Z');

describe('PersonVerdict', () => {
  it('labels people’s verdict as marked right or marked wrong', () => {
    expect(
      PersonVerdict.of({ right: true, reason: null, by: BY, at: AT }).labelFrom,
    ).toBe('marked-right');
    expect(
      PersonVerdict.of({ right: false, reason: null, by: BY, at: AT })
        .labelFrom,
    ).toBe('marked-wrong');
  });

  it('keeps a trimmed reason for a run that was wrong, and none for a blank one', () => {
    expect(
      PersonVerdict.of({
        right: false,
        reason: '  It planned the change. ',
        by: BY,
        at: AT,
      }).reason,
    ).toBe('It planned the change.');
    expect(
      PersonVerdict.of({ right: false, reason: '   ', by: BY, at: AT }).reason,
    ).toBeNull();
  });

  it('refuses a reason for a run that was right, and a reason that is too long', () => {
    expect(() =>
      PersonVerdict.of({ right: true, reason: 'Fine', by: BY, at: AT }),
    ).toThrow(InvalidRunVerdictError);
    expect(() =>
      PersonVerdict.of({
        right: false,
        reason: 'x'.repeat(MAX_VERDICT_REASON_CHARS + 1),
        by: BY,
        at: AT,
      }),
    ).toThrow(InvalidRunVerdictError);
  });
});
