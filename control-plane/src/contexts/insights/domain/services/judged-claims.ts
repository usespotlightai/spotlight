import type { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';

export const judgedClaimsOf = (
  judge: Scored | null,
  current: Rubric | null,
  judgedBy: Rubric | null,
): readonly (string | null)[] => {
  if (!judge) {
    return [];
  }

  const rubric =
    [judgedBy, current].find((each) => each?.version === judge.rubricVersion) ??
    null;

  return judge.claimResults.map((_, at) => rubric?.claims[at] ?? null);
};
