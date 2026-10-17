import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';
import {
  isRunFailureCode,
  type RunFailureCode,
} from '@shared-kernel/domain/value-objects/run-failure-code';
import { InvalidRunOutcomeError } from '@work/domain/exceptions/invalid-run-outcome.error';

export const RUN_FAILURES = {
  exited: Retry.never(),
  unprepared: Retry.never(),
  refused: Retry.never(),
  unprovisioned: Retry.never(),
  'hooks-unanswered': Retry.backoff({
    max: 6,
    firstMs: 5_000,
    longestMs: 120_000,
  }),
  'runner-lost': Retry.backoff({ max: 3, firstMs: 0, longestMs: 0 }),
  'timed-out': Retry.backoff({ max: 3, firstMs: 0, longestMs: 0 }),
  cancelled: Retry.never(),
  superseded: Retry.never(),
} as const satisfies Record<RunFailureCode, Retry>;

export class RunFailure {
  private constructor(readonly code: RunFailureCode) {}

  static of(code: string): RunFailure {
    if (!isRunFailureCode(code)) {
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

  get superseded(): boolean {
    return this.code === 'superseded';
  }

  equals(other: RunFailure): boolean {
    return this.code === other.code;
  }
}
