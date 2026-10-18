import {
  HOOK_FAILURES,
  HookFailure,
  type HookFailureCode,
} from '@integrations/domain/value-objects/hook-failure.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

describe('HookFailure', () => {
  it.each<[HookFailureCode, boolean]>([
    ['unreachable', true],
    ['timeout', true],
    ['throttled', true],
    ['server-error', true],
    ['tool-failed', true],
    ['errored', true],
    ['rejected', false],
    ['not-allowed', false],
    ['unwritable', false],
    ['broken', false],
    ['loop', false],
    ['superseded', false],
  ])(
    'states whether a firing that failed as %s may be retried (%s)',
    (code, allowsRetry) => {
      expect(HookFailure.of(code, 'why').retry.allowsRetry).toBe(allowsRetry);
    },
  );

  it('states a retry for every code it knows', () => {
    expect(Object.keys(HOOK_FAILURES)).toHaveLength(12);
  });

  it('schedules a later attempt for a failure worth retrying, and no attempt after its last one', () => {
    const failure = HookFailure.of('server-error', 'was answered 503');

    expect(failure.nextAttemptAfter(1, NOW)).toEqual(
      new Date(NOW.getTime() + 2_000),
    );
    expect(failure.nextAttemptAfter(3, NOW)).toEqual(
      new Date(NOW.getTime() + 8_000),
    );
    expect(failure.nextAttemptAfter(8, NOW)).toBeNull();
  });

  it('schedules no next attempt for a failure that no retry would mend', () => {
    expect(
      HookFailure.of('rejected', 'was answered 404').nextAttemptAfter(1, NOW),
    ).toBeNull();
  });

  it.each<[number, HookFailureCode]>([
    [400, 'rejected'],
    [403, 'rejected'],
    [404, 'rejected'],
    [408, 'throttled'],
    [425, 'throttled'],
    [429, 'throttled'],
    [500, 'server-error'],
    [503, 'server-error'],
  ])('reads an answer of %i as %s', (status, code) => {
    expect(HookFailure.answered(status, 'answered').code).toBe(code);
  });

  it('keeps its reason when it is superseded', () => {
    const superseded = HookFailure.of(
      'rejected',
      'was answered 404',
    ).superseded();

    expect(superseded.code).toBe('superseded');
    expect(superseded.reason).toBe('was answered 404');
  });
});
