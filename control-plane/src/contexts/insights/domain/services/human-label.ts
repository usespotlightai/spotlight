import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';

type LabelSource = 'grade' | 'accepted' | 'sent-back' | 'merged' | 'closed';

export interface HumanLabel {
  readonly value: number;
  readonly claimResults: readonly boolean[] | null;
  readonly from: LabelSource;
}

const gradedBy = (grade: Scored, rubricVersion: string | null): boolean =>
  grade.rubricVersion === null ||
  rubricVersion === null ||
  grade.rubricVersion === rubricVersion;

const latestGrade = (
  scale: ScoreScale,
  rubricVersion: string | null,
  grades: readonly Scored[],
): Scored | null =>
  grades
    .filter(
      (each) =>
        !each.fromJudge &&
        each.scale.equals(scale) &&
        gradedBy(each, rubricVersion),
    )
    .sort((one, other) => other.at.getTime() - one.at.getTime())[0] ?? null;

export const humanLabelOf = (input: {
  scale: ScoreScale;
  rubricVersion: string | null;
  fact: RunFact | null;
  grades: readonly Scored[];
}): HumanLabel | null => {
  const grade = latestGrade(input.scale, input.rubricVersion, input.grades);

  if (grade) {
    return {
      value: grade.value,
      claimResults: grade.claimResults,
      from: 'grade',
    };
  }

  if (!input.scale.categorical) {
    return null;
  }

  const action = input.fact?.firstHumanAction;
  const pullRequest = input.fact?.pullRequest ?? null;

  if (action?.accepts) {
    return { value: input.scale.yes, claimResults: null, from: 'accepted' };
  }
  if (action?.sendsBack) {
    return { value: input.scale.no, claimResults: null, from: 'sent-back' };
  }
  if (pullRequest?.state === 'merged') {
    return { value: input.scale.yes, claimResults: null, from: 'merged' };
  }
  if (pullRequest?.state === 'closed') {
    return { value: input.scale.no, claimResults: null, from: 'closed' };
  }

  return null;
};
