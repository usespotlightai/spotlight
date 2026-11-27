import type { SearchWarning } from '@replays/domain/services/search-warnings';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { SearchSkipReason } from '@replays/domain/value-objects/search-skip-reason';
import type { SearchTrigger } from '@replays/domain/value-objects/search-trigger';
import { firstOf } from '@shared-kernel/domain/item-at';

const HOUR_MS = 60 * 60 * 1000;

const DAY_MS = 24 * HOUR_MS;

export const BUSY_RECHECK_MS = HOUR_MS;

export const SET_RECHECK_MS = DAY_MS;

export type ScheduleVerdict =
  | {
      readonly kind: 'start';
      readonly trigger: SearchTrigger;
      readonly policy: SearchPolicy;
    }
  | {
      readonly kind: 'skip';
      readonly reason: SearchSkipReason;
      readonly checkAfter: Date;
    }
  | { readonly kind: 'wait'; readonly checkAfter: Date };

export type SetSkipReason = Extract<
  SearchSkipReason,
  | 'set-too-small'
  | 'noisy'
  | 'judge-unstable'
  | 'judge-disagrees-with-people'
  | 'flaky-checks'
  | 'no-headroom'
  | 'no-fresh-held-out'
  | 'ceiling-too-low'
  | 'no-agent'
>;

export type SetVerdict =
  | { readonly kind: 'go'; readonly agent: SearchAgent | null }
  | {
      readonly kind: 'skip';
      readonly reason: SetSkipReason;
      readonly checkAfter: Date;
      readonly warning: SearchWarning | null;
    };

export interface SpendingSearch {
  readonly isActive: boolean;
  readonly spent: Money;
  readonly budget: { readonly ceiling: Money };
}

const after = (at: Date, ms: number): Date => new Date(at.getTime() + ms);

export const monthStartOf = (at: Date): Date =>
  new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));

export const nextMonthStartOf = (at: Date): Date =>
  new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));

const committedBy = (search: SpendingSearch): Money =>
  search.isActive && search.spent.isWithin(search.budget.ceiling)
    ? search.budget.ceiling
    : search.spent;

export const monthSpentOf = (
  searches: readonly SpendingSearch[],
  currency: string,
): Money =>
  searches
    .map(committedBy)
    .filter((each) => each.currency === currency)
    .reduce((sum, each) => sum.plus(each), Money.none(currency));

const fitsMonth = (policy: SearchPolicy, monthSpent: Money): boolean =>
  monthSpent.plus(policy.ceiling).isWithin(policy.monthlyCeiling);

export const fitsMonthAfter = (
  policy: SearchPolicy,
  startedThisMonth: readonly SpendingSearch[],
): boolean =>
  fitsMonth(
    policy,
    monthSpentOf(startedThisMonth, policy.monthlyCeiling.currency),
  );

export type RequestRefusal =
  | 'result-pending'
  | 'pull-request-open'
  | 'monthly-ceiling'
  | 'request-limit'
  | 'no-scoring';

export const requestRefusalOf = (input: {
  readonly resultPending: boolean;
  readonly pullRequestOpen: boolean;
  readonly fitsMonth: boolean;
  readonly takesRequest: boolean;
  readonly scores: boolean;
}): RequestRefusal | null => {
  if (input.resultPending) {
    return 'result-pending';
  }
  if (input.pullRequestOpen) {
    return 'pull-request-open';
  }
  if (!input.fitsMonth) {
    return 'monthly-ceiling';
  }
  if (!input.takesRequest) {
    return 'request-limit';
  }

  return input.scores ? null : 'no-scoring';
};

const periodEndOf = (
  policy: SearchPolicy,
  lastStartedAt: Date | null,
): Date | null =>
  lastStartedAt ? after(lastStartedAt, policy.periodMilliseconds) : null;

const cooldownEndOf = (
  policy: SearchPolicy,
  cooldownFrom: Date | null,
): Date | null =>
  cooldownFrom ? after(cooldownFrom, policy.cooldownMilliseconds) : null;

const alertedUnder = (
  policy: SearchPolicy,
  alertPendingSince: Date | null,
): boolean => policy.onAlert && alertPendingSince !== null;

export interface DueInput {
  readonly policy: SearchPolicy | null;
  readonly scores: boolean;
  readonly lastStartedAt: Date | null;
  readonly cooldownFrom: Date | null;
  readonly alertPendingSince: Date | null;
  readonly now: Date;
  readonly busy: boolean;
  readonly pullRequestOpen: boolean;
  readonly monthSpent: Money | null;
}

export const dueVerdict = (input: DueInput): ScheduleVerdict => {
  const { policy, lastStartedAt, cooldownFrom, now } = input;

  if (!policy?.enabled) {
    return { kind: 'wait', checkAfter: after(now, SET_RECHECK_MS) };
  }
  if (!input.scores) {
    return {
      kind: 'skip',
      reason: 'no-scoring',
      checkAfter: after(now, SET_RECHECK_MS),
    };
  }
  if (input.busy) {
    return { kind: 'wait', checkAfter: after(now, BUSY_RECHECK_MS) };
  }

  const periodEnd = periodEndOf(policy, lastStartedAt);
  const alerted = alertedUnder(policy, input.alertPendingSince);

  if (!alerted && periodEnd && now < periodEnd) {
    return { kind: 'wait', checkAfter: periodEnd };
  }

  const cooldownEnd = cooldownEndOf(policy, cooldownFrom);

  if (cooldownEnd && now < cooldownEnd) {
    return { kind: 'skip', reason: 'cooldown', checkAfter: cooldownEnd };
  }
  if (input.pullRequestOpen) {
    return {
      kind: 'skip',
      reason: 'pull-request-open',
      checkAfter: after(now, BUSY_RECHECK_MS),
    };
  }
  if (
    !fitsMonth(
      policy,
      input.monthSpent ?? Money.none(policy.monthlyCeiling.currency),
    )
  ) {
    return {
      kind: 'skip',
      reason: 'monthly-ceiling',
      checkAfter: nextMonthStartOf(now),
    };
  }

  return { kind: 'start', trigger: alerted ? 'alert' : 'schedule', policy };
};

export interface NextDueInput {
  readonly policy: SearchPolicy | null;
  readonly lastStartedAt: Date | null;
  readonly cooldownFrom: Date | null;
  readonly alertPendingSince: Date | null;
  readonly checkAfter: Date;
  readonly busy: boolean;
  readonly skipped: boolean;
  readonly now: Date;
}

const latest = (times: readonly (Date | null)[]): Date =>
  new Date(
    Math.max(...times.flatMap((each) => (each ? [each.getTime()] : []))),
  );

/**
 * When the next search of the station is due, as the schedule's verdict sees it: once the period, or for an alert the cooldown, has passed, and not before the station's next check.
 * None while the policy is off, while a search is in progress or awaits its result, or while the station's last due search was skipped, since its reason may still hold.
 */
export const nextDueAt = (input: NextDueInput): Date | null => {
  const { policy } = input;

  if (!policy?.enabled || input.busy || input.skipped) {
    return null;
  }

  return latest([
    input.now,
    input.checkAfter,
    alertedUnder(policy, input.alertPendingSince)
      ? null
      : periodEndOf(policy, input.lastStartedAt),
    cooldownEndOf(policy, input.cooldownFrom),
  ]);
};

/** A skip holds only while the policy that would search the station is on. */
export const standingSkipOf = <Skip>(
  policy: SearchPolicy | null,
  lastSkip: Skip | null,
): Skip | null => (policy?.enabled ? lastSkip : null);

export interface SetInput {
  readonly now: Date;
  readonly tooSmall: boolean;
  readonly warnings: readonly SearchWarning[];
  readonly freshHeldOut: boolean;
  readonly affordable: boolean;
  readonly agent: SearchAgent | null;
  readonly needsAgent: boolean;
}

const HEALTH_SKIPS = [
  'noisy',
  'judge-unstable',
  'judge-disagrees-with-people',
  'flaky-checks',
  'no-headroom',
] as const satisfies readonly (SearchSkipReason & SearchWarning['kind'])[];

export const setVerdict = (input: SetInput): SetVerdict => {
  const skip = (
    reason: SetSkipReason,
    warning: SearchWarning | null = null,
  ): SetVerdict => ({
    kind: 'skip',
    reason,
    checkAfter: after(input.now, SET_RECHECK_MS),
    warning,
  });
  const warned = firstOf(
    HEALTH_SKIPS.flatMap((reason) => {
      const warning = input.warnings.find((each) => each.kind === reason);

      return warning ? [{ reason, warning }] : [];
    }),
  );

  if (input.tooSmall) {
    return skip('set-too-small');
  }
  if (warned !== undefined) {
    return skip(warned.reason, warned.warning);
  }
  if (!input.freshHeldOut) {
    return skip('no-fresh-held-out');
  }
  if (!input.affordable) {
    return skip('ceiling-too-low');
  }
  if (input.needsAgent && !input.agent) {
    return skip('no-agent');
  }

  return { kind: 'go', agent: input.agent };
};
