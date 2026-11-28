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
  'start-gate-unanswered': Retry.backoff({
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

type RunEndFailureCode = Exclude<RunFailureCode, 'superseded'>;

/** Why a run failed: in its own work, or for a reason outside it that no change to its prompt can fix. */
export type RunFailureCause =
  | 'work'
  | 'refused'
  | 'setup'
  | 'infrastructure'
  | 'cancelled';

const RUN_FAILURE_CAUSES = {
  exited: 'work',
  'timed-out': 'work',
  refused: 'refused',
  unprepared: 'setup',
  unprovisioned: 'infrastructure',
  'start-gate-unanswered': 'infrastructure',
  'runner-lost': 'infrastructure',
  cancelled: 'cancelled',
} as const satisfies Record<RunEndFailureCode, RunFailureCause>;

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

  /** Why a run that ended so failed; none for a run that did not fail, or failed in a way only its requester knows, such as a superseded task run. */
  static causeOfEnding(ending: {
    readonly cancelled: boolean;
    readonly failure: string | null;
  }): RunFailureCause | null {
    if (ending.cancelled) {
      return 'cancelled';
    }

    return ending.failure !== null && isRunEndFailureCode(ending.failure)
      ? RunFailure.of(ending.failure).cause
      : null;
  }

  get cause(): RunFailureCause {
    return RUN_FAILURE_CAUSES[this.code];
  }

  get countsAttempts(): boolean {
    return this.retry.allowsRetry || this.code === 'unprovisioned';
  }

  get cancelled(): boolean {
    return this.code === 'cancelled';
  }

  equals(other: RunFailure): boolean {
    return this.code === other.code;
  }
}
