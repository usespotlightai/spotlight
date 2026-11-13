import {
  InvalidChangeStackError,
  type StackProblem,
  shapeProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import {
  type DiffFacts,
  placedHunks,
} from '@change-review/domain/services/diff-facts';
import { DraftedStack } from '@change-review/domain/services/drafted-stack';
import { factProblems } from '@change-review/domain/services/fact-rules';
import { withLinkedHunksInOneCohort } from '@change-review/domain/services/linked-cohorts';
import { shownHunks } from '@change-review/domain/services/shown-questions';
import {
  changeLayerCount,
  cohortHeaderProblems,
  layerNoteProblems,
} from '@change-review/domain/services/stack-checks';
import { type StackPart } from '@change-review/domain/services/stack-part';
import { StackProposal } from '@change-review/domain/services/stack-proposal';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import {
  type DraftedLayer,
  type DraftedLayerDetails,
  type DraftedLayerPlan,
  type DraftedOutline,
  MAX_QUESTIONS,
  type OutlinedCohort,
  type ProposedCohort,
  type ProposedLayer,
  type StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';

const asOneLayer = (cohort: OutlinedCohort): ProposedCohort => ({
  ...cohort,
  layers: [
    {
      title: cohort.title,
      summary: cohort.intent,
      dependsOn: [],
      hunks: cohort.hunks.map((hunk) => ({ hunk })),
      notes: [],
      questions: [],
    },
  ],
});

const PLANNED = 'Written once the layers are settled';

const asDrafted = (
  layer: ProposedLayer,
  details: DraftedLayerDetails,
): DraftedLayer => ({ ...layer, ...details });

const withDetailsIn = (
  diff: Diff,
  layers: readonly ProposedLayer[],
  l: number,
  details: DraftedLayerDetails,
): ProposedLayer | null => {
  const layer = layers[l];

  if (!layer) {
    return null;
  }

  const [read] = DraftedStack.layers([asDrafted(layer, details)]);
  const touched = diff.pathsOf(layer.hunks.map((entry) => entry.hunk));
  const shown = shownHunks(layers, l);
  const noted = new Set<string>();

  return {
    ...layer,
    notes: (read?.notes ?? []).filter((each) => {
      const kept = touched.has(each.path) && !noted.has(each.path);
      noted.add(each.path);
      return kept;
    }),
    questions: (read?.questions ?? [])
      .filter(
        (each) =>
          each.hunks.length > 0 && each.hunks.every((hunk) => shown.has(hunk)),
      )
      .slice(0, MAX_QUESTIONS),
  };
};

const outlineShapeProblems = (
  diff: Diff,
  facts: DiffFacts,
  cohorts: readonly OutlinedCohort[],
): StackProblem[] => {
  const problems: string[] = [];
  const known = new Set(diff.hunks.map((hunk) => hunk.id));
  const placed = placedHunks(facts);
  const assigned = new Map<string, number>();

  if (cohorts.length === 0) {
    problems.push('has no cohorts');
  }

  cohorts.forEach((cohort, c) => {
    const where = `cohort ${c + 1}`;

    problems.push(...cohortHeaderProblems(cohort, where));
    if (cohort.hunks.length === 0) {
      problems.push(`${where} has no hunks`);
    }

    for (const hunk of cohort.hunks) {
      if (!known.has(hunk)) {
        problems.push(`${where} names ${hunk}, which is not in the diff`);
      } else {
        assigned.set(hunk, (assigned.get(hunk) ?? 0) + 1);
      }
    }
  });

  for (const hunk of placed) {
    const times = assigned.get(hunk) ?? 0;

    if (times === 0) {
      problems.push(`leaves ${hunk} out`);
    } else if (times > 1) {
      problems.push(`assigns ${hunk} ${times} times`);
    }
  }

  return problems.map(shapeProblem);
};

const withoutIncidental = (
  facts: DiffFacts,
  cohorts: readonly OutlinedCohort[],
): OutlinedCohort[] => {
  const incidental = new Set(
    facts.hunks.filter((each) => each.incidental).map((each) => each.hunk),
  );

  return cohorts.flatMap((cohort) => {
    if (cohort.hunks.length === 0) {
      return [cohort];
    }

    const hunks = cohort.hunks.filter((hunk) => !incidental.has(hunk));
    return hunks.length > 0 ? [{ ...cohort, hunks }] : [];
  });
};

export const StackOutline = {
  validate(input: {
    diff: Diff;
    facts: DiffFacts;
    cohorts: readonly DraftedOutline[];
  }): OutlinedCohort[] {
    const cohorts = withoutIncidental(
      input.facts,
      DraftedStack.outline(input.cohorts),
    );
    const problemsOf = (each: readonly OutlinedCohort[]) => [
      ...outlineShapeProblems(input.diff, input.facts, each),
      ...factProblems(each.map(asOneLayer), input.facts),
    ];
    const problems = problemsOf(cohorts);
    const repaired =
      problems.length > 0
        ? withLinkedHunksInOneCohort(input.diff, input.facts, cohorts)
        : cohorts;

    const left = problems.length > 0 ? problemsOf(repaired) : [];
    if (left.length > 0) {
      throw new InvalidChangeStackError(left);
    }

    return repaired.map((cohort) => ({
      ...cohort,
      joinedBecause: cohort.joinedBecause?.trim() || null,
    }));
  },

  of(cohort: StackCohort): OutlinedCohort {
    return {
      kind: cohort.kind,
      title: cohort.title,
      intent: cohort.intent,
      joinedBecause: cohort.joinedBecause,
      hunks: cohort.layers.flatMap((layer) =>
        layer.hunks.map((entry) => entry.hunk),
      ),
    };
  },

  kept(cohort: StackCohort): ProposedCohort {
    const place = new Map(cohort.layers.map((layer, at) => [layer.id, at + 1]));

    return {
      kind: cohort.kind,
      title: cohort.title,
      intent: cohort.intent,
      joinedBecause: cohort.joinedBecause,
      layers: cohort.layers.map((layer) => ({
        title: layer.title,
        summary: layer.summary,
        dependsOn: layer.dependsOn.flatMap((dependency) => {
          const at = place.get(dependency.layer);
          return at ? [{ layer: at, because: dependency.because }] : [];
        }),
        hunks: layer.hunks.map((entry) => ({ hunk: entry.hunk })),
        notes: layer.notes.map((note) => ({ ...note })),
        questions: layer.questions.map(({ question, answer, hunks }) => ({
          question,
          answer,
          hunks: [...hunks],
        })),
      })),
    };
  },

  proposed(
    cohort: OutlinedCohort,
    layers: readonly DraftedLayer[],
  ): ProposedCohort {
    const { hunks: _, ...outlined } = cohort;
    return { ...outlined, layers: DraftedStack.layers(layers) };
  },

  layered(
    part: StackPart,
    cohort: OutlinedCohort,
    layers: readonly DraftedLayer[],
    redrafting?: StackCohort,
  ): ProposedCohort {
    return StackOutline.checked(
      part,
      StackOutline.proposed(cohort, layers),
      redrafting,
    );
  },

  checked(
    part: StackPart,
    proposed: ProposedCohort,
    redrafting?: StackCohort,
  ): ProposedCohort {
    return StackProposal.checkedCohort({
      diff: part.diff,
      facts: part.facts,
      cohort: proposed,
      changeLayersAtLeast: redrafting && changeLayerCount([redrafting]),
    });
  },

  planned(
    part: StackPart,
    cohort: OutlinedCohort,
    plan: readonly DraftedLayerPlan[],
    redrafting?: StackCohort,
  ): ProposedCohort {
    return StackOutline.checked(
      part,
      StackOutline.plan(part, cohort, plan),
      redrafting,
    );
  },

  plan(
    part: StackPart,
    cohort: OutlinedCohort,
    plan: readonly DraftedLayerPlan[],
  ): ProposedCohort {
    return StackOutline.proposed(
      cohort,
      plan.map((layer) => ({
        ...layer,
        notes: [
          ...part.diff.pathsOf(
            layer.hunks.flatMap((entry) => HunkId.parsed(entry.hunk) ?? []),
          ),
        ].map((path) => ({ path, note: PLANNED })),
        questions: [],
      })),
    );
  },

  detailProblems(
    part: StackPart,
    plan: ProposedCohort,
    l: number,
    details: DraftedLayerDetails,
  ): StackProblem[] {
    const layer = withDetailsIn(part.diff, plan.layers, l, details);

    return layer
      ? layerNoteProblems(part.diff, layer, `layer ${l + 1}`).map(shapeProblem)
      : [shapeProblem(`has no layer ${l + 1}`)];
  },

  detailed(
    part: StackPart,
    plan: ProposedCohort,
    details: readonly DraftedLayerDetails[],
  ): ProposedCohort {
    return {
      ...plan,
      layers: plan.layers.map(
        (layer, l) =>
          withDetailsIn(
            part.diff,
            plan.layers,
            l,
            details[l] ?? { notes: [], questions: [] },
          ) ?? layer,
      ),
    };
  },
};
