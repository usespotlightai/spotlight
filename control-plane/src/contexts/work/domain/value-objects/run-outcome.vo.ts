import { InvalidRunOutcomeError } from '@work/domain/exceptions/invalid-run-outcome.error';
import {
  RunFailure,
  type RunFailureCode,
} from '@work/domain/value-objects/run-failure.vo';

export interface RefusalReason {
  readonly saying: string;
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
    message?: string | null;
  }): RunOutcome {
    if (!Number.isInteger(input.exitCode)) {
      throw new InvalidRunOutcomeError(
        `must exit with a whole number, but was ${input.exitCode}`,
      );
    }

    return new RunOutcome(
      input.exitCode,
      input.failed ? RunFailure.of('exited') : null,
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
      reasons.map((each) => each.saying).join('; '),
    );
  }

  static unprovisioned(
    failure: { readonly saying: string },
    attempts: number,
  ): RunOutcome {
    return RunOutcome.failedWith(
      'unprovisioned',
      `No runner was provisioned for it in ${attempts} attempts; the last was ${failure.saying}`,
    );
  }

  static unanswered(because: string, tries: number): RunOutcome {
    return RunOutcome.failedWith(
      'hooks-unanswered',
      `Its hooks could not be asked after ${tries} tries: ${because}`,
    );
  }

  static lost(attempts: number): RunOutcome {
    return RunOutcome.failedWith(
      'runner-lost',
      `no runner finished it in ${attempts} attempts`,
    );
  }

  static superseded(reason: string): RunOutcome {
    return RunOutcome.failedWith('superseded', reason);
  }

  static stopped(exitCode: number): RunOutcome {
    return new RunOutcome(exitCode, null, 'Stopped from the console.', true);
  }

  private static failedWith(code: RunFailureCode, message: string): RunOutcome {
    return new RunOutcome(-1, RunFailure.of(code), message);
  }

  get failed(): boolean {
    return this.failure !== null;
  }

  get succeeded(): boolean {
    return !this.failed;
  }

  get superseded(): boolean {
    return this.failure?.superseded ?? false;
  }

  supersede(): RunOutcome {
    return this.failed && !this.superseded
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
