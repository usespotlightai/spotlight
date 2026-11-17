import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const LABEL_SOURCES = [
  'grade',
  'accepted',
  'sent-back',
  'merged',
  'held',
] as const;

export type LabelSource = (typeof LABEL_SOURCES)[number];

export interface HumanLabel {
  readonly passes: boolean;
  readonly claimResults: readonly boolean[] | null;
  readonly from: LabelSource;
  readonly by: UserId | null;
}

const latestGradeOf = (
  rubricVersion: string,
  grades: readonly Scored[],
): Scored | null =>
  grades
    .filter((each) => !each.fromJudge && each.rubricVersion === rubricVersion)
    .sort((one, other) => other.at.getTime() - one.at.getTime())[0] ?? null;

export const freeLabelOf = (fact: RunFact | null): HumanLabel | null => {
  const action = fact?.firstHumanAction;
  const pullRequest = fact?.pullRequest ?? null;

  if (action?.accepts) {
    return {
      passes: true,
      claimResults: null,
      from: 'accepted',
      by: action.by,
    };
  }
  if (action?.rejectsRun) {
    return {
      passes: false,
      claimResults: null,
      from: action.takesOver ? 'held' : 'sent-back',
      by: action.by,
    };
  }
  if (
    pullRequest?.state === 'merged' &&
    fact?.ending === 'completed' &&
    fact.followedAt === null
  ) {
    return { passes: true, claimResults: null, from: 'merged', by: null };
  }

  return null;
};

export const hasFreeLabel = (fact: RunFact | null): boolean =>
  freeLabelOf(fact) !== null;

export const humanLabelOf = (input: {
  rubricVersion: string;
  fact: RunFact | null;
  grades: readonly Scored[];
}): HumanLabel | null => {
  const grade = latestGradeOf(input.rubricVersion, input.grades);

  return grade
    ? {
        passes: grade.passes,
        claimResults: grade.claimResults,
        from: 'grade',
        by: grade.by,
      }
    : freeLabelOf(input.fact);
};
