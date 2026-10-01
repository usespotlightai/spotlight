import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { Score } from '@outcomes/domain/aggregates/score.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';

type LabelSource = 'grade' | 'accepted' | 'sent-back' | 'merged' | 'closed';

export interface HumanLabel {
  readonly value: number;
  readonly from: LabelSource;
}

const gradedBy = (grade: Score, rubricVersion: string | null): boolean =>
  grade.rubricVersion === null ||
  rubricVersion === null ||
  grade.rubricVersion === rubricVersion;

const latestGrade = (
  scale: ScoreScale,
  rubricVersion: string | null,
  grades: readonly Score[],
): Score | null =>
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
  record: RunRecord | null;
  delivery: TaskDelivery | null;
  grades: readonly Score[];
}): HumanLabel | null => {
  const grade = latestGrade(input.scale, input.rubricVersion, input.grades);

  if (grade) {
    return { value: grade.value, from: 'grade' };
  }

  if (!input.scale.categorical) {
    return null;
  }

  const next = input.record?.next;

  if (next?.accepts) {
    return { value: input.scale.yes, from: 'accepted' };
  }
  if (next?.sendsBack) {
    return { value: input.scale.no, from: 'sent-back' };
  }
  if (input.delivery?.state === 'merged') {
    return { value: input.scale.yes, from: 'merged' };
  }
  if (input.delivery?.state === 'closed') {
    return { value: input.scale.no, from: 'closed' };
  }

  return null;
};
