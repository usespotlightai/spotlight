import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { describe, expect, it } from 'vitest';

describe('RunOutcome', () => {
  it('tells a run that failed before its agent was handed it from one whose agent failed', () => {
    expect(
      RunOutcome.of({ exitCode: -1, failed: true, setupFailed: true }).failure
        ?.code,
    ).toBe('unprepared');
    expect(RunOutcome.of({ exitCode: -1, failed: true }).failure?.code).toBe(
      'exited',
    );
    expect(
      RunOutcome.of({ exitCode: 0, failed: false, setupFailed: true }).failure,
    ).toBeNull();
  });

  it('hands over only what a run finished of its own accord', () => {
    expect(RunOutcome.of({ exitCode: 0, failed: false }).handsOver).toBe(true);
    expect(RunOutcome.of({ exitCode: 1, failed: true }).handsOver).toBe(false);
    expect(RunOutcome.stopped(0).handsOver).toBe(false);
  });

  it('is cancelled, not superseded, when a run ends before a runner claims it', () => {
    const cancelled = RunOutcome.cancelled('The task moved on.');

    expect(cancelled.failure?.code).toBe('cancelled');
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.superseded).toBe(false);
    expect(cancelled.message).toBe('The task moved on.');
    expect(cancelled.supersede()).toBe(cancelled);
  });

  it('supersedes a failure that is not cancelled', () => {
    const superseded = RunOutcome.of({ exitCode: 1, failed: true }).supersede();

    expect(superseded.superseded).toBe(true);
    expect(superseded.cancelled).toBe(false);
  });
});
