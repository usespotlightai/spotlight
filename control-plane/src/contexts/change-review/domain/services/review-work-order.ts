import type { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';

export type ReviewWorkItem =
  | { readonly kind: 'diff'; readonly diff: PushDiff }
  | { readonly kind: 'check'; readonly check: StackCheck };

// Where an item stands in the order of review work: push diffs first, by the time Spotlight recorded them, then checks, by how long they wait. The tie-breakers decide between items of the same kind and time, so the order is total.
export interface ReviewWorkPlace {
  readonly rank: number;
  readonly time: number;
  readonly tieBreakers: readonly string[];
}

const DIFF_RANK = 0;

const CHECK_RANK = 1;

export const placeOf = (item: ReviewWorkItem): ReviewWorkPlace =>
  item.kind === 'diff'
    ? {
        rank: DIFF_RANK,
        time: item.diff.recordedAt.getTime(),
        tieBreakers: [item.diff.id.value],
      }
    : {
        rank: CHECK_RANK,
        time: item.check.waitingSince.getTime(),
        tieBreakers: [item.check.stackId.value, item.check.recheck ? '1' : '0'],
      };

const tiePrecedes = (
  one: readonly string[],
  other: readonly string[],
): boolean => {
  for (const [index, each] of one.entries()) {
    const against = other[index];

    if (against === undefined || each !== against) {
      return against !== undefined && each < against;
    }
  }

  return one.length < other.length;
};

// The one place comes strictly before the other; a place never precedes itself.
export const precedes = (
  one: ReviewWorkPlace,
  other: ReviewWorkPlace,
): boolean =>
  one.rank !== other.rank
    ? one.rank < other.rank
    : one.time !== other.time
      ? one.time < other.time
      : tiePrecedes(one.tieBreakers, other.tieBreakers);

const placeOrder = (one: ReviewWorkItem, other: ReviewWorkItem): number => {
  const [first, second] = [placeOf(one), placeOf(other)];

  if (precedes(first, second)) {
    return -1;
  }

  return precedes(second, first) ? 1 : 0;
};

export const reviewWorkOrder = (
  diffs: readonly PushDiff[],
  checks: readonly StackCheck[],
): ReviewWorkItem[] =>
  [
    ...diffs.map((diff) => ({ kind: 'diff' as const, diff })),
    ...checks.map((check) => ({ kind: 'check' as const, check })),
  ].sort(placeOrder);
