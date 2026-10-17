import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { withoutSuperseded } from '@memory/domain/services/superseded-memories';
import { isWarning } from '@memory/domain/value-objects/memory-kind';
import type { TouchedSite } from '@memory/domain/value-objects/run-site';

const MAX_BRIEFED = 8;

const MAX_BRIEFED_LENGTH = 3_000;

const MAX_OMITTED = 20;

const TASK_WEIGHT = 3;

const WARNING_WEIGHT = 1;

const RECALLED_WEIGHT = 0.5;

const STRONG_RANK = 0.1;

export interface BriefingCandidate {
  readonly memory: Memory;
  readonly rank: number;
  readonly recalled: number;
}

export interface BriefingChoice {
  readonly briefed: readonly Memory[];
  readonly cut: readonly Memory[];
}

const REPOSITORY_SPECIFICITY = 1;

const matchOf = (rank: number): number =>
  Math.min(1, Math.max(0, rank / STRONG_RANK));

const relevantAt = (
  candidate: BriefingCandidate,
  site: TouchedSite,
): boolean => {
  const { memory, rank } = candidate;

  return (
    memory.appliesAt(site) && (memory.scope.matches(site) || matchOf(rank) > 0)
  );
};

const specificityAt = (memory: Memory, site: TouchedSite): number =>
  memory.scope.matches(site)
    ? memory.scope.specificity
    : REPOSITORY_SPECIFICITY;

const bearing = (candidate: BriefingCandidate, site: TouchedSite): number =>
  specificityAt(candidate.memory, site) +
  TASK_WEIGHT * matchOf(candidate.rank) +
  (isWarning(candidate.memory.kind) ? WARNING_WEIGHT : 0) +
  (candidate.recalled > 0 ? RECALLED_WEIGHT : 0);

export const selectForBriefing = (
  candidates: readonly BriefingCandidate[],
  site: TouchedSite,
): BriefingChoice => {
  const current = new Set(
    withoutSuperseded(candidates.map((each) => each.memory)),
  );
  const ranked = candidates
    .filter((each) => current.has(each.memory) && relevantAt(each, site))
    .map((each) => ({ memory: each.memory, bears: bearing(each, site) }))
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
      chosen.length === MAX_BRIEFED ||
      length + memory.body.length > MAX_BRIEFED_LENGTH
    ) {
      break;
    }

    chosen.push(memory);
    length += memory.body.length;
  }

  return {
    briefed: chosen,
    cut: ranked.slice(chosen.length, chosen.length + MAX_OMITTED),
  };
};
