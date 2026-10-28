import {
  countsOf,
  type OriginalOutcome,
} from '@replays/domain/services/composition';

const SUGGESTED_FIRST: readonly OriginalOutcome[] = [
  'accepted',
  'sent-back',
  'asked',
  'failed',
];

export const newestOfEachTask = <T extends { readonly task: string }>(
  newestFirst: readonly T[],
  setTasks: readonly string[],
): readonly T[] => {
  const seen = new Set(setTasks);

  return newestFirst.filter((each) => {
    const unseen = !seen.has(each.task);
    seen.add(each.task);
    return unseen;
  });
};

interface Suggestible {
  readonly outcome: OriginalOutcome;
}

export const balancingPicks = <T extends Suggestible>(
  setOutcomes: readonly OriginalOutcome[],
  newestFirst: readonly T[],
  max: number,
): readonly T[] => {
  const counts = new Map(
    countsOf(setOutcomes).map((each) => [each.outcome, each.count]),
  );
  const countOf = (outcome: OriginalOutcome): number =>
    counts.get(outcome) ?? 0;
  const left = [...newestFirst];
  const picks: T[] = [];

  while (picks.length < max) {
    const ceiling = Math.max(...counts.values());
    const [short] = SUGGESTED_FIRST.filter(
      (outcome) =>
        countOf(outcome) < ceiling &&
        left.some((each) => each.outcome === outcome),
    ).sort(
      (one, other) =>
        countOf(one) - countOf(other) ||
        SUGGESTED_FIRST.indexOf(one) - SUGGESTED_FIRST.indexOf(other),
    );

    if (!short) {
      break;
    }

    const [picked] = left.splice(
      left.findIndex((each) => each.outcome === short),
      1,
    );
    picks.push(picked);
    counts.set(short, countOf(short) + 1);
  }

  return picks;
};
