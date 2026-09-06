import { InvalidRunOutcomeError } from '@domain/exceptions/invalid-run-outcome.error';

/**
 * How a run ended: the code the harness exited with, whether the runner judged
 * it a failure, and anything it said about why. `failed` is the runner's own
 * verdict, not read off the exit code — a run can exit cleanly and still be
 * failed, or the other way round.
 */
export class RunOutcome {
  private constructor(
    readonly exitCode: number,
    readonly failed: boolean,
    readonly message: string | null,
    // A person stopped the run: not a failure, but distinct from a run that
    // finished on its own, so what happens to the task next can tell them apart.
    readonly stopped: boolean = false,
  ) {}

  static of(input: {
    exitCode: number;
    failed: boolean;
    message?: string | null;
  }): RunOutcome {
    if (!Number.isInteger(input.exitCode)) {
      throw new InvalidRunOutcomeError(
        `must exit with a whole number, but was ${input.exitCode}`,
      );
    }

    return new RunOutcome(
      input.exitCode,
      input.failed,
      input.message?.trim() || null,
    );
  }

  static abandoned(reason: string): RunOutcome {
    return new RunOutcome(-1, true, reason);
  }

  static stopped(exitCode: number): RunOutcome {
    return new RunOutcome(exitCode, false, 'Stopped from the console.', true);
  }

  get succeeded(): boolean {
    return !this.failed;
  }

  equals(other: RunOutcome): boolean {
    return (
      this.exitCode === other.exitCode &&
      this.failed === other.failed &&
      this.message === other.message &&
      this.stopped === other.stopped
    );
  }
}
