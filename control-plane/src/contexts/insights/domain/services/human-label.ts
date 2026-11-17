import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const LABEL_SOURCES = [
  'accepted',
  'sent-back',
  'merged',
  'held',
] as const;

export type LabelSource = (typeof LABEL_SOURCES)[number];

export const passesOn = (from: LabelSource): boolean =>
  from === 'accepted' || from === 'merged';

export interface HumanLabel {
  readonly passes: boolean;
  readonly from: LabelSource;
  readonly by: UserId | null;
}

const labelled = (from: LabelSource, by: UserId | null): HumanLabel => ({
  passes: passesOn(from),
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
  label: { readonly passes: boolean } | null,
): boolean | null => (judge && label ? judge.passes === label.passes : null);
