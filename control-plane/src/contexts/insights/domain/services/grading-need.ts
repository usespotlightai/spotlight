import { hasFreeLabel } from '@insights/domain/services/human-label';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { ScoreFact } from '@insights/domain/value-objects/score-fact.vo';

export const FREE_LABEL_COVERAGE_MIN = 0.5;

export const GRADING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const GRADING_WINDOW_RUNS = 500;

export const freeLabelCoverageOf = (input: {
  readonly judged: readonly ScoreFact[];
  readonly facts: readonly RunFact[];
  readonly now: Date;
}): number | null => {
  const since = input.now.getTime() - GRADING_WINDOW_MS;
  const runs = new Set(
    input.judged
      .filter(
        (each) =>
          each.fromJudge &&
          each.origin === 'live' &&
          each.at.getTime() >= since,
      )
      .map((each) => each.runId.value),
  );

  if (runs.size === 0) {
    return null;
  }

  const labelled = input.facts.filter(
    (each) => runs.has(each.runId.value) && hasFreeLabel(each),
  ).length;

  return labelled / runs.size;
};

export const needsGrades = (coverage: number | null): boolean =>
  coverage === null || coverage < FREE_LABEL_COVERAGE_MIN;
