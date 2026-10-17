import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

const AGAIN = Retry.backoff({
  maxAttempts: 4,
  initialDelayMs: 30_000,
  maxDelayMs: 600_000,
});

const ONCE_MORE = Retry.backoff({
  maxAttempts: 3,
  initialDelayMs: 30_000,
  maxDelayMs: 300_000,
});

export const JUDGING_FAILURES = {
  'no-evidence': Retry.never(),
  'request-failed': AGAIN,
  unreadable: ONCE_MORE,
  ungrounded: ONCE_MORE,
  errored: AGAIN,
  interrupted: Retry.never(),
  unavailable: Retry.never(),
} as const satisfies Record<string, Retry>;

export type JudgingFailureCode = keyof typeof JUDGING_FAILURES;

const isCode = (code: string): code is JudgingFailureCode =>
  Object.keys(JUDGING_FAILURES).includes(code);

export class JudgingFailure {
  private constructor(
    readonly code: JudgingFailureCode,
    readonly at: Date,
  ) {}

  static of(code: string, at: Date): JudgingFailure {
    if (!isCode(code)) {
      throw InvalidScoreError.ofJudging(`failed with unknown code ${code}`);
    }

    return new JudgingFailure(code, at);
  }

  get retry(): Retry {
    return JUDGING_FAILURES[this.code];
  }
}
