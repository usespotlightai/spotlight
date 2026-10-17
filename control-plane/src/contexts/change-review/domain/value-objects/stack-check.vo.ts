import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import {
  type CheckHold,
  holdsAt,
} from '@change-review/domain/value-objects/check-claim.vo';
import type {
  HunkId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';

const STACK_CHECK_STATES = ['waiting', 'checked', 'skipped'] as const;

export type StackCheckState = (typeof STACK_CHECK_STATES)[number];

export const CHECK_PHASES = [
  'waiting',
  'reordering',
  'checked',
  'skipped',
] as const;

export type CheckPhase = (typeof CHECK_PHASES)[number];

export const WAITING_LIMIT_MS = 60 * 60 * 1000;

export interface CheckStanding {
  readonly phase: CheckPhase;
  readonly waitingSince: Date;
  readonly hold: CheckHold;
}

const waitedOutAt = (check: CheckStanding, now: Date): boolean =>
  now.getTime() - check.waitingSince.getTime() > WAITING_LIMIT_MS &&
  !holdsAt(check.hold, now);

export const checkStateAt = (
  check: CheckStanding,
  now: Date,
): StackCheckState => {
  switch (check.phase) {
    case 'waiting':
      return waitedOutAt(check, now) ? 'skipped' : 'waiting';
    case 'reordering':
      return 'waiting';
    default:
      return check.phase;
  }
};

export const WHOLE_STEP = 'whole';

export type StepId = LayerId | typeof WHOLE_STEP;

export const MAX_CHECK_COMMAND = 500;

export interface CheckStep {
  readonly id: StepId;
  readonly hunks: readonly HunkId[];
  readonly isWholeChange: boolean;
  readonly installsAnew: boolean;
}

export interface CheckedStep {
  readonly step: StepId;
  readonly passed: boolean;
  readonly output: string;
  readonly tookMs: number;
}

export const REPORTED_SKIPS = [
  'no-base',
  'no-checkout',
  'checkout-failed',
  'setup-failed',
  'no-room',
  'out-of-time',
  'no-image',
] as const;

type ReportedSkip = (typeof REPORTED_SKIPS)[number];

const NOBODY_CHECKED = 'nobody-checked';

const UNPROVISIONED = 'unprovisioned';

export type SkipCode =
  | ReportedSkip
  | typeof NOBODY_CHECKED
  | typeof UNPROVISIONED;

const MAX_SKIP_DETAIL = 2_000;

export interface StackSkip {
  readonly code: SkipCode;
  readonly detail: string | null;
}

export const skipOf = (code: string, detail: string | null): StackSkip => {
  if (!REPORTED_SKIPS.includes(code as ReportedSkip)) {
    throw InvalidChangeStackError.because(
      `was skipped for ${code}, which is not a reason a runner can give`,
    );
  }

  const trimmed = detail?.trim().slice(-MAX_SKIP_DETAIL);

  return { code: code as ReportedSkip, detail: trimmed ? trimmed : null };
};

export const keptSkipOf = (code: string, detail: string | null): StackSkip => {
  switch (code) {
    case UNPROVISIONED:
      return { code: UNPROVISIONED, detail };
    case NOBODY_CHECKED:
      return { code: NOBODY_CHECKED, detail };
    default:
      return skipOf(code, detail);
  }
};

export const unprovisioned = (
  failure: { readonly saying: string },
  attempts: number,
): StackSkip => ({
  code: UNPROVISIONED,
  detail: `Attempts: ${attempts}\nLast failure: ${failure.saying}`,
});

export const nobodyChecked = (): StackSkip => ({
  code: NOBODY_CHECKED,
  detail: null,
});

export interface CheckOutcome {
  readonly state: Exclude<StackCheckState, 'waiting'>;
  readonly skip: StackSkip | null;
  readonly whole: CheckedStep | null;
  readonly layers: readonly CheckedStep[];
  readonly checkedAt: Date;
}

export interface CheckEntry {
  readonly hunk: HunkId;
  readonly layer: LayerId;
}
