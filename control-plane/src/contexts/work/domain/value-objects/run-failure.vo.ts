import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';
import { InvalidRunOutcomeError } from '@work/domain/exceptions/invalid-run-outcome.error';

export const RUN_FAILURES = {
  exited: Retry.never(),
  refused: Retry.never(),
  unprovisioned: Retry.never(),
  'hooks-unanswered': Retry.backoff({
    most: 6,
    firstMs: 5_000,
    longestMs: 120_000,
  }),
  'runner-lost': Retry.backoff({ most: 3, firstMs: 0, longestMs: 0 }),
  superseded: Retry.never(),
} as const satisfies Record<string, Retry>;

export type RunFailureCode = keyof typeof RUN_FAILURES;

const isCode = (code: string): code is RunFailureCode =>
  Object.keys(RUN_FAILURES).includes(code);

export class RunFailure {
  private constructor(readonly code: RunFailureCode) {}

  static of(code: string): RunFailure {
    if (!isCode(code)) {
      throw new InvalidRunOutcomeError(
        `failed in a way nobody knows (${code})`,
      );
    }

    return new RunFailure(code);
  }

  get retry(): Retry {
    return RUN_FAILURES[this.code];
  }

  get superseded(): boolean {
    return this.code === 'superseded';
  }

  equals(other: RunFailure): boolean {
    return this.code === other.code;
  }
}
