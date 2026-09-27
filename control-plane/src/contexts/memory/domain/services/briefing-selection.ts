import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { isWarning } from '@memory/domain/value-objects/memory-kind';
import type { MemoryPlace } from '@memory/domain/value-objects/memory-scope.vo';

const MOST_BRIEFED = 8;

const MOST_BRIEFED_LENGTH = 3_000;

const MOST_CUT_KEPT = 20;

const TASK_WEIGHT = 3;

const WARNING_WEIGHT = 1;

const RECALLED_WEIGHT = 0.5;

export interface BriefingCandidate {
  readonly memory: Memory;
  readonly match: number;
  readonly recalled: number;
}

export interface BriefingChoice {
  readonly briefed: readonly Memory[];
  readonly cut: readonly Memory[];
}

const REPOSITORY_SPECIFICITY = 1;

const reaching = (
  candidate: BriefingCandidate,
  place: MemoryPlace,
): boolean => {
  const { memory, match } = candidate;

  return (
    memory.standing === 'stands' &&
    (memory.scope.reaches(place) ||
      (match > 0 && memory.scope.appliesAt(place)))
  );
};

const specificityAt = (memory: Memory, place: MemoryPlace): number =>
  memory.scope.reaches(place)
    ? memory.scope.specificity
    : REPOSITORY_SPECIFICITY;

const bearing = (candidate: BriefingCandidate, place: MemoryPlace): number =>
  specificityAt(candidate.memory, place) +
  TASK_WEIGHT * Math.min(1, Math.max(0, candidate.match)) +
  (isWarning(candidate.memory.kind) ? WARNING_WEIGHT : 0) +
  (candidate.recalled > 0 ? RECALLED_WEIGHT : 0);

export const selectForBriefing = (
  candidates: readonly BriefingCandidate[],
  place: MemoryPlace,
): BriefingChoice => {
  const ranked = candidates
    .filter((each) => reaching(each, place))
    .map((each) => ({ memory: each.memory, bears: bearing(each, place) }))
    .sort(
      (one, other) =>
        other.bears - one.bears ||
        other.memory.approval.at.getTime() - one.memory.approval.at.getTime(),
    )
    .map((each) => each.memory);
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

  return {
    briefed: chosen,
    cut: ranked.slice(chosen.length, chosen.length + MOST_CUT_KEPT),
  };
};
