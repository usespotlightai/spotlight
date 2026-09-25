import { InvalidRunOutcomeError } from '@work/domain/exceptions/invalid-run-outcome.error';

export interface RefusalReason {
  readonly saying: string;
}

export class RunOutcome {
  private constructor(
    readonly exitCode: number,
    readonly failed: boolean,
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
      input.failed,
      input.message?.trim() || null,
    );
  }

  static rehydrate(input: {
    exitCode: number;
    failed: boolean;
    message: string | null;
    stopped: boolean;
  }): RunOutcome {
    return new RunOutcome(
      input.exitCode,
      input.failed,
      input.message,
      input.stopped,
    );
  }

  static refused(reasons: readonly RefusalReason[]): RunOutcome {
    return new RunOutcome(
      -1,
      true,
      reasons.map((each) => each.saying).join('; '),
    );
  }

  static unprovisioned(
    failure: { readonly saying: string },
    attempts: number,
  ): RunOutcome {
    return new RunOutcome(
      -1,
      true,
      `No runner was provisioned for it in ${attempts} attempts; the last was ${failure.saying}`,
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
