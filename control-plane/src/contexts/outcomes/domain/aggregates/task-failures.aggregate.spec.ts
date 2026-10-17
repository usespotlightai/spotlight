import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import { day, failuresOf } from '@outcomes/domain/insights.fake-spec';
import { FailureOccurrence } from '@outcomes/domain/value-objects/failure-occurrence.vo';
import { describe, expect, it } from 'vitest';

describe('TaskFailures', () => {
  it('keeps every raise and repeat, the oldest first', () => {
    const failures = failuresOf('task_1', [
      { occurrences: 2, at: day('2026-09-29', 11) },
      { occurrences: 1, at: day('2026-09-29', 10) },
    ]);

    expect(failures.occurrences.map((each) => each.occurrences)).toEqual([
      1, 2,
    ]);
    expect(failures.lastAt).toEqual(day('2026-09-29', 11));
  });

  it('keeps a failure heard twice once', () => {
    const failures = failuresOf('task_1', [{ at: day('2026-09-29') }]);

    expect(
      failures.raise(
        FailureOccurrence.of({
          stationId: 'station_1',
          runId: null,
          source: 'hook:notify',
          code: 'loop',
          occurrences: 1,
          at: day('2026-09-29'),
        }),
      ),
    ).toBe(failures);
  });

  it('comes from a run or a named hook, and says what went wrong', () => {
    const of = (source: string, code: string) =>
      FailureOccurrence.of({
        stationId: 'station_1',
        runId: null,
        source,
        code,
        occurrences: 1,
        at: day('2026-09-29'),
      });

    expect(of('run', 'exited').fromHook).toBe(false);
    expect(of('hook:notify', 'loop').fromHook).toBe(true);
    expect(() => of('hook:', 'loop')).toThrow(InvalidOutcomeError);
    expect(() => of('cron', 'loop')).toThrow(InvalidOutcomeError);
    expect(() => of('run', ' ')).toThrow(InvalidOutcomeError);
  });
});
