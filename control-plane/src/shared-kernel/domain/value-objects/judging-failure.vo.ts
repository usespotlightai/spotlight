import { InvalidJudgingFailureError } from '@shared-kernel/domain/exceptions/invalid-judging-failure.error';
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

export const JUDGING_FAILURE_CODES = [
  'no-evidence',
  'request-failed',
  'insufficient-credits',
  'unreadable',
  'ungrounded',
  'errored',
  'interrupted',
  'unavailable',
] as const;

export type JudgingFailureCode = (typeof JUDGING_FAILURE_CODES)[number];

const JUDGING_FAILURES: Readonly<Record<JudgingFailureCode, Retry>> = {
  'no-evidence': Retry.never(),
  'request-failed': AGAIN,
  'insufficient-credits': Retry.never(),
  unreadable: ONCE_MORE,
  ungrounded: ONCE_MORE,
  errored: AGAIN,
  interrupted: Retry.never(),
  unavailable: Retry.never(),
};

const isCode = (code: string): code is JudgingFailureCode =>
  JUDGING_FAILURE_CODES.some((each) => each === code);

export class JudgingFailure {
  private constructor(
    readonly code: JudgingFailureCode,
    readonly at: Date,
  ) {}

  static of(code: string, at: Date): JudgingFailure {
    if (!isCode(code)) {
      throw new InvalidJudgingFailureError(code);
    }

    return new JudgingFailure(code, at);
  }

  get retry(): Retry {
    return JUDGING_FAILURES[this.code];
  }
}
