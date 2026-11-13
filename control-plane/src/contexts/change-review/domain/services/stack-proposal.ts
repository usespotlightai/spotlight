import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import {
  derivedDependencies,
  factProblems,
} from '@change-review/domain/services/fact-rules';
import { mergedByLayer } from '@change-review/domain/services/layer-dependencies';
import { withLayersInOrder } from '@change-review/domain/services/layer-order';
import {
  movedGroups,
  withMovedCodeTogether,
} from '@change-review/domain/services/moved-code';
import { PreviousStack } from '@change-review/domain/services/previous-stack';
import { keptQuestions } from '@change-review/domain/services/shown-questions';
import {
  changeLayerCount,
  layerCountProblems,
  shapeProblems,
} from '@change-review/domain/services/stack-checks';
import { stackPartsOf } from '@change-review/domain/services/stack-part';
import { withTestsBesideTheirCode } from '@change-review/domain/services/test-placement';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import {
  type LayerDependency,
  type LayerRevision,
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
  revisions: readonly (readonly LayerRevision[])[] | null,
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
          revision: revisions ? (revisions[c]?.[l] ?? null) : null,
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
  changeLayersAtLeast: number | undefined,
): number =>
  changeLayersAtLeast === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(changeLayerCount(cohorts) - changeLayersAtLeast, 0);

const repaired = (
  proposal: Proposal,
  cohorts: readonly ProposedCohort[],
  changeLayersAtLeast: number | undefined,
): ProposedCohort[] => {
  const moved = movedGroups(proposal.facts);
  const partOf = stackPartsOf(proposal.diff, proposal.facts);
  let budget = layerBudgetOf(cohorts, changeLayersAtLeast);

  return cohorts.map((cohort) => {
    const counted = cohort.kind === 'change';
    const ordered = withLayersInOrder(
      partOf,
      cohort,
      counted ? budget : Number.POSITIVE_INFINITY,
    );
    const tests = withTestsBesideTheirCode(
      partOf,
      ordered.cohort,
      counted ? ordered.layerBudget : Number.POSITIVE_INFINITY,
    );
    const repair = withMovedCodeTogether(
      partOf,
      moved,
      tests.cohort,
      counted ? tests.layerBudget : Number.POSITIVE_INFINITY,
    );

    if (counted) {
      budget = repair.layerBudget;
    }
    return repair.cohort;
  });
};

interface Checking {
  readonly changeLayersAtLeast: number | undefined;
  readonly scope: 'stack' | 'cohort';
}

const checked = (
  proposal: Proposal,
  cohorts: readonly ProposedCohort[],
  checking: Checking,
  modelProposal: readonly ProposedCohort[] = cohorts,
): ProposedCohort[] => {
  const problemsOf = (each: readonly ProposedCohort[]) => [
    ...shapeProblems(proposal.diff, each),
    ...factProblems(each, proposal.facts),
    ...(checking.scope === 'stack'
      ? layerCountProblems(each, checking.changeLayersAtLeast)
      : []),
  ];
  const repairedCohorts = repaired(
    proposal,
    cohorts,
    checking.changeLayersAtLeast,
  );

  if (problemsOf(repairedCohorts).length === 0) {
    return repairedCohorts;
  }

  const found = problemsOf(cohorts);
  const modelRepaired =
    modelProposal === cohorts
      ? repairedCohorts
      : repaired(proposal, modelProposal, checking.changeLayersAtLeast);

  throw new InvalidChangeStackError(
    problemsOf(modelRepaired).length > 0 ? problemsOf(modelProposal) : found,
  );
};

const checkedCohort = (
  input: Proposal & {
    readonly cohort: ProposedCohort;
    readonly changeLayersAtLeast?: number;
  },
): ProposedCohort =>
  checked(input, [input.cohort], {
    changeLayersAtLeast: input.changeLayersAtLeast,
    scope: 'cohort',
  })[0] ?? input.cohort;

const accepted = (
  input: Proposal & {
    readonly cohorts: readonly ProposedCohort[];
    readonly modelProposal?: readonly ProposedCohort[];
    readonly changeLayersAtLeast?: number;
    readonly previous?: PreviousStack | null;
  },
): StackCohort[] => {
  const cohorts = checked(
    input,
    input.cohorts,
    { changeLayersAtLeast: input.changeLayersAtLeast, scope: 'stack' },
    input.modelProposal,
  );

  if (!input.previous) {
    return numbered(cohorts, input.facts, null);
  }

  const revised = PreviousStack.revised(input.previous, cohorts);

  return numbered(revised.cohorts, input.facts, revised.revisions);
};

export const StackProposal = { checkedCohort, accepted };
