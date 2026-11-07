import { DELIVERING } from '@integrations/domain/services/delivery-retry';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

export const HOOK_FAILURES = {
  unreachable: DELIVERING,
  timeout: DELIVERING,
  throttled: DELIVERING,
  'server-error': DELIVERING,
  unavailable: DELIVERING,
  'tool-failed': Retry.never(),
  errored: Retry.never(),
  rejected: Retry.never(),
  'not-allowed': Retry.never(),
  unwritable: Retry.never(),
  broken: Retry.never(),
  loop: Retry.never(),
  superseded: Retry.never(),
} as const satisfies Record<string, Retry>;

export type HookFailureCode = keyof typeof HOOK_FAILURES;

const MAX_REASON = 1_000;

export type CallFailureFact =
  | {
      readonly kind: 'upstream';
      readonly status: number | null;
      readonly transient: boolean;
      readonly reason: string;
    }
  | { readonly kind: 'blocked'; readonly reason: string }
  | { readonly kind: 'over-outbound-limit'; readonly perSecond: number }
  | { readonly kind: 'unknown'; readonly reason: string };

const THROTTLING = new Set([408, 425, 429]);

const SERVER_ERROR = 500;

export class HookFailure {
  private constructor(
    readonly code: HookFailureCode,
    readonly reason: string,
  ) {}

  static of(code: HookFailureCode, reason: string): HookFailure {
    return new HookFailure(code, reason.trim().slice(0, MAX_REASON));
  }

  static answered(status: number, reason: string): HookFailure {
    if (THROTTLING.has(status)) {
      return HookFailure.of('throttled', reason);
    }

    return HookFailure.of(
      status >= SERVER_ERROR ? 'server-error' : 'rejected',
      reason,
    );
  }

  static notStartedWithin(timeoutSeconds: number): HookFailure {
    return HookFailure.of(
      'timeout',
      `did not start within the hook's ${timeoutSeconds} seconds`,
    );
  }

  static tookLongerThan(timeoutSeconds: number): HookFailure {
    return HookFailure.of(
      'timeout',
      `took longer than the hook's ${timeoutSeconds} seconds`,
    );
  }

  static unwritable(reason: string): HookFailure {
    return HookFailure.of('unwritable', `could not be written: ${reason}`);
  }

  static overOutboundLimit(perSecond: number): HookFailure {
    return HookFailure.of(
      'throttled',
      `this workspace sends more than ${perSecond} requests each second to other services`,
    );
  }

  static refusedByPolicy(reason: string): HookFailure {
    return HookFailure.of('not-allowed', reason);
  }

  static withoutSigningSecret(): HookFailure {
    return HookFailure.of(
      'not-allowed',
      'has no secret to sign with. Spotlight sent nothing. Please set a new secret for the hook with a higher secretVersion',
    );
  }

  static withoutTokenKey(): HookFailure {
    return HookFailure.of(
      'not-allowed',
      'needs a key to sign its OIDC token. This deployment has none',
    );
  }

  static hostsUnread(reason: string): HookFailure {
    return HookFailure.of(
      'unavailable',
      `Spotlight could not read the workspace's allowed hosts: ${reason}`,
    );
  }

  static unavailable(reason: string): HookFailure {
    return HookFailure.of('unavailable', reason);
  }

  static noLongerAStep(): HookFailure {
    return HookFailure.of('broken', 'is no longer a step of the hook');
  }

  static ofBrokenHook(): HookFailure {
    return HookFailure.of(
      'broken',
      'belongs to a hook that no longer reads as it was written',
    );
  }

  static callFailed(fact: CallFailureFact): HookFailure {
    if (fact.kind === 'blocked') {
      return HookFailure.of('not-allowed', fact.reason);
    }

    if (fact.kind === 'over-outbound-limit') {
      return HookFailure.overOutboundLimit(fact.perSecond);
    }

    if (fact.kind === 'unknown' || !fact.transient) {
      return HookFailure.of('tool-failed', fact.reason);
    }

    if (fact.status === null) {
      return HookFailure.of('unreachable', fact.reason);
    }

    return HookFailure.answered(fact.status, fact.reason);
  }

  static errored(reason: string): HookFailure {
    return HookFailure.of('errored', reason);
  }

  get retry(): Retry {
    return HOOK_FAILURES[this.code];
  }

  nextAttemptAfter(attempts: number, now: Date): Date | null {
    return this.retry.nextAttemptAt(attempts, now);
  }

  atStep(hook: string, step: string): HookFailure {
    return HookFailure.of(
      this.code,
      `Hook ${hook} failed at step ${step}. Reason: ${this.reason}`,
    );
  }

  superseded(): HookFailure {
    return HookFailure.of('superseded', this.reason);
  }

  equals(other: HookFailure): boolean {
    return this.code === other.code && this.reason === other.reason;
  }
}
