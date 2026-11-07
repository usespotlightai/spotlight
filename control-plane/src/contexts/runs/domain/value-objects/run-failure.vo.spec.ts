import { InvalidRunOutcomeError } from '@runs/domain/exceptions/invalid-run-outcome.error';
import {
  RUN_FAILURES,
  RunFailure,
} from '@runs/domain/value-objects/run-failure.vo';
import { describe, expect, it } from 'vitest';

describe('RunFailure', () => {
  it.each([
    ['exited', false, 1],
    ['unprepared', false, 1],
    ['refused', false, 1],
    ['unprovisioned', false, 1],
    ['cancelled', false, 1],
    ['start-gate-unanswered', true, 6],
    ['runner-lost', true, 3],
    ['timed-out', true, 3],
  ])(
    'states whether a run that %s may be retried (%s, %i attempts in all)',
    (code, allowsRetry, maxAttempts) => {
      const failure = RunFailure.of(code);

      expect(failure.retry.allowsRetry).toBe(allowsRetry);
      expect(failure.retry.maxAttempts).toBe(maxAttempts);
    },
  );

  it('states a retry for every code it knows', () => {
    expect(Object.keys(RUN_FAILURES).sort()).toEqual(
      [
        'cancelled',
        'exited',
        'start-gate-unanswered',
        'refused',
        'runner-lost',
        'timed-out',
        'unprepared',
        'unprovisioned',
      ].sort(),
    );
  });

  it('rejects a code nobody knows', () => {
    expect(() => RunFailure.of('exploded')).toThrow(InvalidRunOutcomeError);
  });

  it('never ends a run as superseded, which only its task decides', () => {
    expect(() => RunFailure.of('superseded')).toThrow(InvalidRunOutcomeError);
  });
});
