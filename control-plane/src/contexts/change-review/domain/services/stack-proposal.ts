import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import {
  derivedDependencies,
  factProblems,
} from '@change-review/domain/services/fact-rules';
import { mergedByLayer } from '@change-review/domain/services/layer-dependencies';
import {
  movedGroups,
  withMovedCodeTogether,
} from '@change-review/domain/services/moved-code';
import { keptQuestions } from '@change-review/domain/services/shown-questions';
import {
  changeLayerCount,
  layerCountProblems,
  shapeProblems,
} from '@change-review/domain/services/stack-checks';
import { stackPartsOf } from '@change-review/domain/services/stack-part';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import {
  type LayerDependency,
  type ProposedCohort,
  type ProposedLayer,
  type StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import {
  CohortId,
  LayerId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';

const mergedDependencies = (
  cohortId: CohortId,
  proposed: ProposedLayer['dependsOn'],
  derived: ReadonlyMap<number, ReadonlySet<string>> | undefined,
): LayerDependency[] => {
  const merged = mergedByLayer([
    ...proposed.map((dependency) => ({
      layer: dependency.layer,
      because: dependency.because.flatMap((symbol) => symbol.trim() || []),
    })),
    ...[...(derived ?? [])].map(([layer, because]) => ({
      layer,
      because: [...because],
    })),
  ]);

  return [...merged.entries()]
    .sort(([a], [b]) => a - b)
    .map(([layer, because]) => ({
      layer: LayerId.in(cohortId, layer),
      because: [...because],
    }));
};

const numbered = (
  cohorts: readonly ProposedCohort[],
  facts: DiffFacts,
): StackCohort[] => {
  const derived = derivedDependencies(cohorts, facts.links);

  return cohorts.map((cohort, c) => {
    const cohortId = CohortId.at(c + 1);

    return {
      id: cohortId,
      kind: cohort.kind,
      title: cohort.title.trim(),
      intent: cohort.intent.trim(),
      joinedBecause: cohort.joinedBecause?.trim() || null,
      layers: cohort.layers.map((layer, l) => {
        const layerId = LayerId.in(cohortId, l + 1);

        return {
          id: layerId,
          title: layer.title.trim(),
          summary: layer.summary.trim(),
          dependsOn: mergedDependencies(
            cohortId,
            layer.dependsOn,
            derived.get(`${c}.${l}`),
          ),
          hunks: layer.hunks.map((entry) => ({ hunk: entry.hunk })),
          notes: layer.notes.map((each) => ({
            path: each.path,
            note: each.note.trim(),
          })),
          questions: keptQuestions(cohort, l).map((each, q) => ({
            id: QuestionId.in(layerId, q + 1),
            question: each.question.trim(),
            answer: each.answer.trim(),
            hunks: [...new Set(each.hunks)],
          })),
        };
      }),
    };
  });
};

interface Proposal {
  readonly diff: Diff;
  readonly facts: DiffFacts;
}

const layerBudgetOf = (
  cohorts: readonly ProposedCohort[],
  changeLayersBefore: number | undefined,
): number =>
  changeLayersBefore === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(changeLayerCount(cohorts) - changeLayersBefore, 0);

const repaired = (
  proposal: Proposal,
  cohorts: readonly ProposedCohort[],
  layerBudget: number,
): ProposedCohort[] => {
  const moved = movedGroups(proposal.facts);
  const partOf = stackPartsOf(proposal.diff, proposal.facts);
  let budget = layerBudget;

  return cohorts.map((cohort) => {
    const counted = cohort.kind === 'change';
    const repair = withMovedCodeTogether(
      partOf,
      moved,
      cohort,
      counted ? budget : Number.POSITIVE_INFINITY,
    );

    if (counted) {
      budget = repair.layerBudget;
    }
    return repair.cohort;
  });
};

const checked = (
  proposal: Proposal,
  cohorts: readonly ProposedCohort[],
  changeLayersBefore: number | undefined,
  changeLayersAtLeast: number | undefined,
): ProposedCohort[] => {
  const problemsOf = (each: readonly ProposedCohort[]) => [
    ...shapeProblems(proposal.diff, each),
    ...factProblems(each, proposal.facts),
    ...layerCountProblems(each, changeLayersAtLeast),
  ];
  const repairedCohorts = repaired(
    proposal,
    cohorts,
    layerBudgetOf(cohorts, changeLayersBefore),
  );

  if (problemsOf(repairedCohorts).length > 0) {
    throw new InvalidChangeStackError(problemsOf(cohorts));
  }
  return repairedCohorts;
};

const checkedCohort = (
  input: Proposal & {
    readonly cohort: ProposedCohort;
    readonly changeLayersBefore?: number;
  },
): ProposedCohort =>
  checked(input, [input.cohort], input.changeLayersBefore, undefined)[0] ??
  input.cohort;

const accepted = (
  input: Proposal & {
    readonly cohorts: readonly ProposedCohort[];
    readonly changeLayersAtLeast?: number;
  },
): StackCohort[] =>
  numbered(
    checked(
      input,
      input.cohorts,
      input.changeLayersAtLeast,
      input.changeLayersAtLeast,
    ),
    input.facts,
  );

export const StackProposal = { checkedCohort, accepted };
