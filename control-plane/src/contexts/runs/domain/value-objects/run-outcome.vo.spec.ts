import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { describe, expect, it } from 'vitest';

describe('RunOutcome', () => {
  it('names how the run ended', () => {
    expect(
      [
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        RunOutcome.of({ exitCode: ExitCode.of(1), failed: true }),
        RunOutcome.stopped(ExitCode.of(0)),
        RunOutcome.refused([{ description: 'names no harness' }]),
        RunOutcome.cancelled('Task moved on'),
      ].map((each) => each.ending),
    ).toEqual(['completed', 'failed', 'stopped', 'refused', 'cancelled']);
  });

  it('tells a run that failed before its agent was handed it from one whose agent failed', () => {
    expect(
      RunOutcome.of({
        exitCode: ExitCode.of(-1),
        failed: true,
        setupFailed: true,
      }).failure?.code,
    ).toBe('unprepared');
    expect(
      RunOutcome.of({ exitCode: ExitCode.of(-1), failed: true }).failure?.code,
    ).toBe('exited');
    expect(
      RunOutcome.of({
        exitCode: ExitCode.of(0),
        failed: false,
        setupFailed: true,
      }).failure,
    ).toBeNull();
  });

  it('hands over only what a run finished of its own accord', () => {
    expect(
      RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }).handsOver,
    ).toBe(true);
    expect(
      RunOutcome.of({ exitCode: ExitCode.of(1), failed: true }).handsOver,
    ).toBe(false);
    expect(RunOutcome.stopped(ExitCode.of(0)).handsOver).toBe(false);
  });

  it('is cancelled when a run ends before a runner claims it', () => {
    const cancelled = RunOutcome.cancelled('The task moved on.');

    expect(cancelled.failure?.code).toBe('cancelled');
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.detail).toBe('The task moved on.');
  });
});
