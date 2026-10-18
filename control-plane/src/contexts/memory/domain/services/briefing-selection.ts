import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { withoutSuperseded } from '@memory/domain/services/superseded-memories';
import { isWarning } from '@memory/domain/value-objects/memory-kind';
import type { TouchedContext } from '@memory/domain/value-objects/run-context';

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
  readonly omitted: readonly Memory[];
}

const REPOSITORY_SPECIFICITY = 1;

const matchOf = (rank: number): number =>
  Math.min(1, Math.max(0, rank / STRONG_RANK));

const relevantAt = (
  candidate: BriefingCandidate,
  runContext: TouchedContext,
): boolean => {
  const { memory, rank } = candidate;

  return (
    memory.appliesAt(runContext) &&
    (memory.scope.matches(runContext) || matchOf(rank) > 0)
  );
};

const specificityAt = (memory: Memory, runContext: TouchedContext): number =>
  memory.scope.matches(runContext)
    ? memory.scope.specificity
    : REPOSITORY_SPECIFICITY;

const scoreOf = (
  candidate: BriefingCandidate,
  runContext: TouchedContext,
): number =>
  specificityAt(candidate.memory, runContext) +
  TASK_WEIGHT * matchOf(candidate.rank) +
  (isWarning(candidate.memory.kind) ? WARNING_WEIGHT : 0) +
  (candidate.recalled > 0 ? RECALLED_WEIGHT : 0);

export const selectForBriefing = (
  candidates: readonly BriefingCandidate[],
  runContext: TouchedContext,
): BriefingChoice => {
  const current = new Set(
    withoutSuperseded(candidates.map((each) => each.memory)),
  );
  const ranked = candidates
    .filter((each) => current.has(each.memory) && relevantAt(each, runContext))
    .map((each) => ({ memory: each.memory, score: scoreOf(each, runContext) }))
    .sort(
      (one, other) =>
        other.score - one.score ||
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
    omitted: ranked.slice(chosen.length, chosen.length + MAX_OMITTED),
  };
};
