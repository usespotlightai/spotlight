import { DELIVERING } from '@integrations/domain/services/delivery-retry';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

export const HOOK_FAILURES = {
  unreachable: DELIVERING,
  timeout: DELIVERING,
  throttled: DELIVERING,
  'server-error': DELIVERING,
  'tool-failed': DELIVERING,
  errored: DELIVERING,
  rejected: Retry.never(),
  'not-allowed': Retry.never(),
  unwritable: Retry.never(),
  broken: Retry.never(),
  loop: Retry.never(),
  superseded: Retry.never(),
} as const satisfies Record<string, Retry>;

export type HookFailureCode = keyof typeof HOOK_FAILURES;

const MAX_REASON = 1_000;

export class HookFailure {
  private constructor(
    readonly code: HookFailureCode,
    readonly reason: string,
  ) {}

  static of(code: HookFailureCode, reason: string): HookFailure {
    return new HookFailure(code, reason.trim().slice(0, MAX_REASON));
  }

  static answered(status: number, reason: string): HookFailure {
    if (status === 408 || status === 425 || status === 429) {
      return HookFailure.of('throttled', reason);
    }

    return HookFailure.of(status >= 500 ? 'server-error' : 'rejected', reason);
  }

  get retry(): Retry {
    return HOOK_FAILURES[this.code];
  }

  nextAttemptAfter(attempts: number, now: Date): Date | null {
    return this.retry.nextAttemptAt(attempts, now);
  }

  superseded(): HookFailure {
    return HookFailure.of('superseded', this.reason);
  }

  equals(other: HookFailure): boolean {
    return this.code === other.code && this.reason === other.reason;
  }
}
