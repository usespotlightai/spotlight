import { InvalidRunOutcomeError } from '@runs/domain/exceptions/invalid-run-outcome.error';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';
import {
  isRunFailureCode,
  type RunFailureCode,
} from '@shared-kernel/domain/value-objects/run-failure-code';

export const RUN_FAILURES = {
  exited: Retry.never(),
  unprepared: Retry.never(),
  refused: Retry.never(),
  unprovisioned: Retry.never(),
  'hooks-unanswered': Retry.backoff({
    maxAttempts: 6,
    initialDelayMs: 5_000,
    maxDelayMs: 120_000,
  }),
  'runner-lost': Retry.backoff({
    maxAttempts: 3,
    initialDelayMs: 0,
    maxDelayMs: 0,
  }),
  'timed-out': Retry.backoff({
    maxAttempts: 3,
    initialDelayMs: 0,
    maxDelayMs: 0,
  }),
  cancelled: Retry.never(),
} as const satisfies Record<RunEndFailureCode, Retry>;

export type RunEndFailureCode = Exclude<RunFailureCode, 'superseded'>;

const isRunEndFailureCode = (code: string): code is RunEndFailureCode =>
  isRunFailureCode(code) && code in RUN_FAILURES;

export class RunFailure {
  private constructor(readonly code: RunEndFailureCode) {}

  static of(code: string): RunFailure {
    if (!isRunEndFailureCode(code)) {
      throw new InvalidRunOutcomeError(`failure code ${code} is unknown`);
    }

    return new RunFailure(code);
  }

  get retry(): Retry {
    return RUN_FAILURES[this.code];
  }

  get cancelled(): boolean {
    return this.code === 'cancelled';
  }

  equals(other: RunFailure): boolean {
    return this.code === other.code;
  }
}
