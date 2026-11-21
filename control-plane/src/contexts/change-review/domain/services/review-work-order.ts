import type { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';

export type ReviewWorkItem =
  | { readonly kind: 'diff'; readonly diff: PushDiff }
  | { readonly kind: 'check'; readonly check: StackCheck };

// Where an item stands in the order of review work: push diffs first, by the time Spotlight recorded them, then checks, by how long they wait. The tie decides between items of the same kind and time, so the order is total.
export interface ReviewWorkPlace {
  readonly rank: number;
  readonly at: number;
  readonly tie: string;
}

const DIFF_RANK = 0;

const CHECK_RANK = 1;

export const placeOf = (item: ReviewWorkItem): ReviewWorkPlace =>
  item.kind === 'diff'
    ? {
        rank: DIFF_RANK,
        at: item.diff.recordedAt.getTime(),
        tie: item.diff.id.value,
      }
    : {
        rank: CHECK_RANK,
        at: item.check.waitingSince.getTime(),
        tie: `${item.check.stackId.value} ${item.check.recheck ? 1 : 0}`,
      };

export const comesBefore = (
  one: ReviewWorkPlace,
  other: ReviewWorkPlace,
): boolean =>
  one.rank !== other.rank
    ? one.rank < other.rank
    : one.at !== other.at
      ? one.at < other.at
      : one.tie < other.tie;

const byPlace = (one: ReviewWorkItem, other: ReviewWorkItem): number => {
  const [first, second] = [placeOf(one), placeOf(other)];

  if (comesBefore(first, second)) {
    return -1;
  }

  return comesBefore(second, first) ? 1 : 0;
};

export const reviewWorkOrder = (
  diffs: readonly PushDiff[],
  checks: readonly StackCheck[],
): ReviewWorkItem[] =>
  [
    ...diffs.map((diff) => ({ kind: 'diff' as const, diff })),
    ...checks.map((check) => ({ kind: 'check' as const, check })),
  ].sort(byPlace);
