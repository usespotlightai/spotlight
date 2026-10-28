import type { SearchWarning } from '@replays/domain/services/search-warnings';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { SearchSkipReason } from '@replays/domain/value-objects/search-skip-reason';
import type { SearchTrigger } from '@replays/domain/value-objects/search-trigger';

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

export type SetVerdict =
  | { readonly kind: 'go'; readonly agent: SearchAgent }
  | {
      readonly kind: 'skip';
      readonly reason: SearchSkipReason;
      readonly checkAfter: Date;
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

export const fitsMonth = (policy: SearchPolicy, monthSpent: Money): boolean =>
  monthSpent.plus(policy.ceiling).isWithin(policy.monthlyCeiling);

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
    return {
      kind: 'skip',
      reason: 'disabled',
      checkAfter: after(now, SET_RECHECK_MS),
    };
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

  const periodEnd = lastStartedAt
    ? after(lastStartedAt, policy.periodMilliseconds)
    : null;
  const alerted = policy.onAlert && input.alertPendingSince !== null;

  if (!alerted && periodEnd && now < periodEnd) {
    return { kind: 'wait', checkAfter: periodEnd };
  }

  const cooldownEnd = cooldownFrom
    ? after(cooldownFrom, policy.cooldownMilliseconds)
    : null;

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

export interface SetInput {
  readonly now: Date;
  readonly tooSmall: boolean;
  readonly warnings: readonly SearchWarning[];
  readonly freshHeldOut: boolean;
  readonly affordable: boolean;
  readonly agent: SearchAgent | null;
}

const HEALTH_SKIPS = [
  'noisy',
  'judge-unstable',
  'flaky-checks',
  'no-headroom',
] as const satisfies readonly (SearchSkipReason & SearchWarning['kind'])[];

export const setVerdict = (input: SetInput): SetVerdict => {
  const skip = (reason: SearchSkipReason): SetVerdict => ({
    kind: 'skip',
    reason,
    checkAfter: after(input.now, SET_RECHECK_MS),
  });
  const warned = HEALTH_SKIPS.find((reason) =>
    input.warnings.some((each) => each.kind === reason),
  );

  if (input.tooSmall) {
    return skip('set-too-small');
  }
  if (warned) {
    return skip(warned);
  }
  if (!input.freshHeldOut) {
    return skip('no-fresh-held-out');
  }
  if (!input.affordable) {
    return skip('ceiling-too-low');
  }
  if (!input.agent) {
    return skip('no-agent');
  }

  return { kind: 'go', agent: input.agent };
};
