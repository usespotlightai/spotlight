import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryPlace } from '@memory/domain/value-objects/memory-scope.vo';

const MOST_BRIEFED = 12;

const MOST_BRIEFED_LENGTH = 4_000;

export const selectForBriefing = (
  memories: readonly Memory[],
  place: MemoryPlace,
): Memory[] => {
  const ranked = memories
    .filter((each) => each.standing === 'stands' && each.scope.reaches(place))
    .sort(
      (one, other) =>
        other.scope.specificity - one.scope.specificity ||
        other.approval.at.getTime() - one.approval.at.getTime(),
    );
  const chosen: Memory[] = [];
  let length = 0;

  for (const memory of ranked) {
    if (
      chosen.length === MOST_BRIEFED ||
      length + memory.body.length > MOST_BRIEFED_LENGTH
    ) {
      break;
    }

    chosen.push(memory);
    length += memory.body.length;
  }

  return chosen;
};
