import type { Scored } from '@insights/domain/value-objects/score-fact.vo';

export const VERDICT_TEACHINGS = ['judge', 'unjudged-run', 'no-judge'] as const;

export type VerdictTeaching = (typeof VERDICT_TEACHINGS)[number];

export const verdictTeachingOf = (
  scores: readonly Scored[],
  current: string | null,
): VerdictTeaching => {
  if (current === null) {
    return 'no-judge';
  }

  return scores.some((each) => each.rubricVersion === current)
    ? 'judge'
    : 'unjudged-run';
};
