import type { RunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';
import { InvalidRunOutcomeError } from '@work/domain/exceptions/invalid-run-outcome.error';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';

export interface RefusalReason {
  readonly description: string;
}

export class RunOutcome {
  private constructor(
    readonly exitCode: number,
    readonly failure: RunFailure | null,
    readonly message: string | null,
    readonly stopped: boolean = false,
  ) {}

  static of(input: {
    exitCode: number;
    failed: boolean;
    setupFailed?: boolean;
    message?: string | null;
  }): RunOutcome {
    if (!Number.isInteger(input.exitCode)) {
      throw new InvalidRunOutcomeError(
        `exit code must be a whole number, not ${input.exitCode}`,
      );
    }

    return new RunOutcome(
      input.exitCode,
      input.failed
        ? RunFailure.of(input.setupFailed ? 'unprepared' : 'exited')
        : null,
      input.message?.trim() || null,
    );
  }

  static rehydrate(input: {
    exitCode: number;
    failure: RunFailure | null;
    message: string | null;
    stopped: boolean;
  }): RunOutcome {
    return new RunOutcome(
      input.exitCode,
      input.failure,
      input.message,
      input.stopped,
    );
  }

  static refused(reasons: readonly RefusalReason[]): RunOutcome {
    return RunOutcome.failedWith(
      'refused',
      reasons.map((each) => each.description).join('; '),
    );
  }

  static unprovisioned(
    failure: { readonly description: string },
    attempts: number,
  ): RunOutcome {
    return RunOutcome.failedWith(
      'unprovisioned',
      `No runner was provisioned after ${attempts} attempts. Last failure: ${failure.description}`,
    );
  }

  static unanswered(because: string, tries: number): RunOutcome {
    return RunOutcome.failedWith(
      'hooks-unanswered',
      `Hooks did not answer after ${tries} tries. Last error: ${because}`,
    );
  }

  static lost(attempts: number): RunOutcome {
    return RunOutcome.failedWith(
      'runner-lost',
      `No runner finished the run after ${attempts} attempts.`,
    );
  }

  static timedOut(attempts: number): RunOutcome {
    return RunOutcome.failedWith(
      'timed-out',
      `Sandbox stopped at the host's time limit. No runner finished the run after ${attempts} attempts.`,
    );
  }

  static cancelled(reason: string): RunOutcome {
    return RunOutcome.failedWith('cancelled', reason);
  }

  static stopped(exitCode: number): RunOutcome {
    return new RunOutcome(exitCode, null, 'A person stopped the run.', true);
  }

  private static failedWith(code: RunFailureCode, message: string): RunOutcome {
    return new RunOutcome(-1, RunFailure.of(code), message);
  }

  get handsOver(): boolean {
    return !this.failed && !this.stopped;
  }

  get failed(): boolean {
    return this.failure !== null;
  }

  get succeeded(): boolean {
    return !this.failed;
  }

  get cancelled(): boolean {
    return this.failure?.cancelled ?? false;
  }

  get superseded(): boolean {
    return this.failure?.superseded ?? false;
  }

  supersede(): RunOutcome {
    return this.failed && !this.superseded && !this.cancelled
      ? new RunOutcome(
          this.exitCode,
          RunFailure.of('superseded'),
          this.message,
          this.stopped,
        )
      : this;
  }

  equals(other: RunOutcome): boolean {
    return (
      this.exitCode === other.exitCode &&
      (this.failure?.code ?? null) === (other.failure?.code ?? null) &&
      this.message === other.message &&
      this.stopped === other.stopped
    );
  }
}
