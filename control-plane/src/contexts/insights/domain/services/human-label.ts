import {
  type LabelSource,
  passesOn,
} from '@insights/domain/value-objects/label-source';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface HumanLabel {
  readonly from: LabelSource;
  readonly by: UserId | null;
}

const labelled = (from: LabelSource, by: UserId | null): HumanLabel => ({
  from,
  by,
});

export const humanLabelOf = (fact: RunFact | null): HumanLabel | null => {
  const action = fact?.firstHumanAction;
  const pullRequest = fact?.pullRequest ?? null;

  if (action?.accepts) {
    return labelled('accepted', action.by);
  }
  if (action?.rejectsRun) {
    return labelled(action.takesOver ? 'held' : 'sent-back', action.by);
  }
  if (
    pullRequest?.state === 'merged' &&
    fact?.ending === 'completed' &&
    fact.followedAt === null
  ) {
    return labelled('merged', null);
  }

  return null;
};

export const judgeAgreesOf = (
  judge: { readonly passes: boolean } | null,
  label: HumanLabel | null,
): boolean | null =>
  judge && label ? judge.passes === passesOn(label.from) : null;
