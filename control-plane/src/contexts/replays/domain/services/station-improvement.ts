import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type {
  SearchSkip,
  StationSearchSchedule,
} from '@replays/domain/aggregates/station-search-schedule.aggregate';
import {
  type PickingSearch,
  type PickPhase,
  pendingPickOf,
} from '@replays/domain/services/pending-pick';
import type { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchSkipReason } from '@replays/domain/value-objects/search-skip-reason';

export const STATION_IMPROVEMENT_STATUSES = [
  'searching',
  'picking',
  'pull-request-open',
  'off',
  'not-started',
  'not-improving',
  'improved',
  'waiting',
] as const;

export type StationImprovementStatus =
  (typeof STATION_IMPROVEMENT_STATUSES)[number];

export const TRANSIENT_SKIP_REASONS = [
  'cooldown',
  'pull-request-open',
  'set-too-small',
  'no-fresh-held-out',
  'monthly-ceiling',
  'no-headroom',
] as const satisfies readonly SearchSkipReason[];

export const isTransientSkip = (reason: SearchSkipReason): boolean =>
  (TRANSIENT_SKIP_REASONS as readonly SearchSkipReason[]).includes(reason);

export type ImprovementBlock =
  | { readonly kind: 'skip'; readonly skip: SearchSkip }
  | {
      readonly kind: 'pull-request-failed';
      readonly reason: ConfigPullRequestReason;
    };

export type StationImprovement =
  | { readonly status: 'searching'; readonly searchId: SearchId }
  | {
      readonly status: 'picking';
      readonly searchId: SearchId;
      readonly phase: PickPhase;
    }
  | { readonly status: 'pull-request-open'; readonly url: string | null }
  | { readonly status: 'off' }
  | { readonly status: 'not-started' }
  | { readonly status: 'not-improving'; readonly block: ImprovementBlock }
  | {
      readonly status: 'improved';
      readonly at: Date;
      readonly url: string | null;
    }
  | { readonly status: 'waiting'; readonly checkAfter: Date };

export interface ImprovementFacts {
  readonly policyEnabled: boolean;
  readonly set: Pick<ReplaySet, 'entries'> | null;
  readonly schedule: StationSearchSchedule | null;
  readonly activeSearch: Pick<Search, 'id'> | null;
  readonly newestSearch: PickingSearch | null;
  readonly pickHasPullRequest: boolean;
  readonly openPullRequest: ConfigPullRequest | null;
  readonly newestMerged: ConfigPullRequest | null;
  readonly newestFailed: ConfigPullRequest | null;
}

const isAfter = (at: Date, other: Date | null): boolean =>
  other === null || at > other;

const blockOf = (
  schedule: StationSearchSchedule,
  failed: ConfigPullRequest | null,
): ImprovementBlock | null => {
  const { lastImprovedAt, lastStartedAt, lastSkip } = schedule;

  if (
    failed?.reason &&
    isAfter(failed.updatedAt, lastImprovedAt) &&
    isAfter(failed.updatedAt, lastStartedAt)
  ) {
    return { kind: 'pull-request-failed', reason: failed.reason };
  }
  if (
    lastSkip &&
    !isTransientSkip(lastSkip.reason) &&
    isAfter(lastSkip.at, lastImprovedAt)
  ) {
    return { kind: 'skip', skip: lastSkip };
  }

  return null;
};

const improvedSince = (schedule: StationSearchSchedule): Date | null => {
  const { lastImprovedAt, lastStartedAt } = schedule;

  return lastImprovedAt && (!lastStartedAt || lastImprovedAt >= lastStartedAt)
    ? lastImprovedAt
    : null;
};

export const improvementOf = (facts: ImprovementFacts): StationImprovement => {
  const { set, schedule, activeSearch, newestSearch } = facts;
  const phase = pendingPickOf(newestSearch, facts.pickHasPullRequest);

  if (activeSearch) {
    return { status: 'searching', searchId: activeSearch.id };
  }
  if (newestSearch && phase) {
    return { status: 'picking', searchId: newestSearch.id, phase };
  }
  if (facts.openPullRequest?.isOpen) {
    return { status: 'pull-request-open', url: facts.openPullRequest.url };
  }
  if (!facts.policyEnabled) {
    return { status: 'off' };
  }
  if (!set || !schedule || set.entries.length === 0) {
    return { status: 'not-started' };
  }

  const block = blockOf(schedule, facts.newestFailed);

  if (block) {
    return { status: 'not-improving', block };
  }

  const improvedAt = improvedSince(schedule);

  if (improvedAt) {
    return {
      status: 'improved',
      at: improvedAt,
      url: facts.newestMerged?.url ?? null,
    };
  }

  return { status: 'waiting', checkAfter: schedule.checkAfter };
};
