import { InvalidRunOutcomeError } from '@runs/domain/exceptions/invalid-run-outcome.error';

const NOT_RUN = -1;

const CLEAN = 0;

export class ExitCode {
  private constructor(readonly value: number) {}

  static of(value: number): ExitCode {
    if (!Number.isInteger(value)) {
      throw new InvalidRunOutcomeError(
        `exit code must be a whole number, not ${value}`,
      );
    }

    return new ExitCode(value);
  }

  static notRun(): ExitCode {
    return new ExitCode(NOT_RUN);
  }

  static clean(): ExitCode {
    return new ExitCode(CLEAN);
  }

  equals(other: ExitCode): boolean {
    return this.value === other.value;
  }
}
