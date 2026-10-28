import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import {
  type CheckLease,
  isLeaseActiveAt,
} from '@change-review/domain/value-objects/check-claim.vo';
import type {
  HunkId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';

const CHECK_STATUS_VIEWS = ['waiting', 'checked', 'skipped'] as const;

export type CheckStatusView = (typeof CHECK_STATUS_VIEWS)[number];

export const STACK_CHECK_STATUSES = [
  'waiting',
  'redrafting',
  'checked',
  'skipped',
] as const;

export type StackCheckStatus = (typeof STACK_CHECK_STATUSES)[number];

export const WAITING_LIMIT_MS = 60 * 60 * 1000;

export interface CheckStatusInput {
  readonly status: StackCheckStatus;
  readonly waitingSince: Date;
  readonly lease: CheckLease;
}

const waitExpiredAt = (check: CheckStatusInput, now: Date): boolean =>
  now.getTime() - check.waitingSince.getTime() > WAITING_LIMIT_MS &&
  !isLeaseActiveAt(check.lease, now);

export const checkStatusAt = (
  check: CheckStatusInput,
  now: Date,
): CheckStatusView => {
  switch (check.status) {
    case 'waiting':
      return waitExpiredAt(check, now) ? 'skipped' : 'waiting';
    case 'redrafting':
      return 'waiting';
    default:
      return check.status;
  }
};

export const WHOLE_STEP = 'whole';

export type StepId = LayerId | typeof WHOLE_STEP;

export const MAX_CHECK_COMMAND = 65_536;

export interface CheckStep {
  readonly id: StepId;
  readonly hunks: readonly HunkId[];
  readonly stopsOnFailure: boolean;
  readonly runsSetup: boolean;
}

export interface CheckedStep {
  readonly step: StepId;
  readonly passed: boolean;
  readonly output: string;
  readonly durationMs: number;
}

export const REPORTED_SKIPS = [
  'no-base',
  'no-checkout',
  'checkout-failed',
  'setup-failed',
  'workspace-failed',
  'out-of-time',
  'no-image',
] as const;

type ReportedSkip = (typeof REPORTED_SKIPS)[number];

const QUEUE_TIMEOUT = 'queue-timeout';

const PROVISION_FAILED = 'provision-failed';

export type SkipCode =
  | ReportedSkip
  | typeof QUEUE_TIMEOUT
  | typeof PROVISION_FAILED;

const MAX_SKIP_DETAIL = 2_000;

export interface StackSkip {
  readonly code: SkipCode;
  readonly detail: string | null;
}

export const skipOf = (code: string, detail: string | null): StackSkip => {
  if (!REPORTED_SKIPS.includes(code as ReportedSkip)) {
    throw InvalidChangeStackError.because(
      `was skipped for ${code}, which is not a reason a runner can report`,
    );
  }

  const trimmed = detail?.trim().slice(-MAX_SKIP_DETAIL);

  return { code: code as ReportedSkip, detail: trimmed ? trimmed : null };
};

export const parseStoredSkip = (
  code: string,
  detail: string | null,
): StackSkip => {
  switch (code) {
    case PROVISION_FAILED:
      return { code: PROVISION_FAILED, detail };
    case QUEUE_TIMEOUT:
      return { code: QUEUE_TIMEOUT, detail };
    default:
      return skipOf(code, detail);
  }
};

export const provisionFailed = (
  failure: { readonly description: string },
  attempts: number,
): StackSkip => ({
  code: PROVISION_FAILED,
  detail: `Attempts: ${attempts}\nLast failure: ${failure.description}`,
});

export const queueTimeout = (): StackSkip => ({
  code: QUEUE_TIMEOUT,
  detail: null,
});

export interface CheckOutcome {
  readonly status: Exclude<CheckStatusView, 'waiting'>;
  readonly skip: StackSkip | null;
  readonly whole: CheckedStep | null;
  readonly layers: readonly CheckedStep[];
  readonly checkedAt: Date;
}

export interface CheckEntry {
  readonly hunk: HunkId;
  readonly layer: LayerId;
}
