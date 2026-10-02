import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { describe, expect, it } from 'vitest';

describe('RunOutcome', () => {
  it('tells a run that failed before its agent was handed it from one whose agent failed', () => {
    expect(
      RunOutcome.of({ exitCode: -1, failed: true, unprepared: true }).failure
        ?.code,
    ).toBe('unprepared');
    expect(RunOutcome.of({ exitCode: -1, failed: true }).failure?.code).toBe(
      'exited',
    );
    expect(
      RunOutcome.of({ exitCode: 0, failed: false, unprepared: true }).failure,
    ).toBeNull();
  });

  it('hands over only what a run finished of its own accord', () => {
    expect(RunOutcome.of({ exitCode: 0, failed: false }).handsOver).toBe(true);
    expect(RunOutcome.of({ exitCode: 1, failed: true }).handsOver).toBe(false);
    expect(RunOutcome.stopped(0).handsOver).toBe(false);
  });
});
