import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { RunFailure } from '@runs/domain/value-objects/run-failure.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';

const COUNTS_ATTEMPTS: readonly RunFailureCode[] = [
  'unprovisioned',
  'start-gate-unanswered',
  'runner-lost',
  'timed-out',
];

export class RunOutcome {
  private constructor(
    readonly exitCode: ExitCode,
    readonly failure: RunFailure | null,
    readonly detail: string | null,
    readonly stopped: boolean = false,
    readonly attempts: number | null = null,
  ) {
    if (attempts === null) {
      return;
    }
    if (!Number.isInteger(attempts) || attempts < 1) {
      throw new InconsistentStateError(
        'run outcome',
        'counts attempts that are not a positive whole number',
      );
    }
    if (!failure || !COUNTS_ATTEMPTS.includes(failure.code)) {
      throw new InconsistentStateError(
        'run outcome',
        'counts attempts for a failure that does not retry',
      );
    }
  }

  static of(input: {
    exitCode: ExitCode;
    failed: boolean;
    setupFailed?: boolean;
    detail?: string | null;
  }): RunOutcome {
    return new RunOutcome(
      input.exitCode,
      input.failed
        ? RunFailure.of(input.setupFailed ? 'unprepared' : 'exited')
        : null,
      input.detail?.trim() || null,
    );
  }

  static rehydrate(input: {
    exitCode: ExitCode;
    failure: RunFailure | null;
    detail: string | null;
    stopped: boolean;
    attempts: number | null;
  }): RunOutcome {
    return new RunOutcome(
      input.exitCode,
      input.failure,
      input.detail,
      input.stopped,
      input.attempts,
    );
  }

  static refused(
    reasons: readonly { readonly description: string }[],
  ): RunOutcome {
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
      failure.description,
      attempts,
    );
  }

  static unanswered(because: string, tries: number): RunOutcome {
    return RunOutcome.failedWith('start-gate-unanswered', because, tries);
  }

  static lost(attempts: number): RunOutcome {
    return RunOutcome.failedWith('runner-lost', null, attempts);
  }

  static timedOut(attempts: number): RunOutcome {
    return RunOutcome.failedWith('timed-out', null, attempts);
  }

  static cancelled(reason: string): RunOutcome {
    return RunOutcome.failedWith('cancelled', reason);
  }

  static stopped(exitCode: ExitCode): RunOutcome {
    return new RunOutcome(exitCode, null, null, true);
  }

  private static failedWith(
    code: RunFailureCode,
    detail: string | null,
    attempts: number | null = null,
  ): RunOutcome {
    return new RunOutcome(
      ExitCode.notRun(),
      RunFailure.of(code),
      detail,
      false,
      attempts,
    );
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

  equals(other: RunOutcome): boolean {
    return (
      this.exitCode.equals(other.exitCode) &&
      (this.failure?.code ?? null) === (other.failure?.code ?? null) &&
      this.detail === other.detail &&
      this.stopped === other.stopped &&
      this.attempts === other.attempts
    );
  }
}
