import {
  freeLabelOf,
  humanLabelOf,
  type LabelSource,
} from '@insights/domain/services/human-label';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';

export interface RunOutcome {
  readonly source: LabelSource;
  readonly passes: boolean;
}

export const runOutcomeOf = (input: {
  rubricVersion: string | null;
  fact: RunFact | null;
  grades: readonly Scored[];
}): RunOutcome | null => {
  const label =
    input.rubricVersion === null
      ? freeLabelOf(input.fact)
      : humanLabelOf({
          rubricVersion: input.rubricVersion,
          fact: input.fact,
          grades: input.grades,
        });

  return label && { source: label.from, passes: label.passes };
};

export const outcomeRubricVersionOf = (input: {
  visibleJudge: Pick<Scored, 'rubricVersion'> | null;
  currentRubricVersion: string | null;
  latestJudge: Pick<Scored, 'rubricVersion'> | null;
}): string | null =>
  input.visibleJudge?.rubricVersion ??
  input.currentRubricVersion ??
  input.latestJudge?.rubricVersion ??
  null;

export const judgeAgreesOf = (
  judge: Pick<Scored, 'passes'> | null,
  outcome: RunOutcome | null,
): boolean | null =>
  judge && outcome ? judge.passes === outcome.passes : null;
