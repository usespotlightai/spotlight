import {
  InvalidChangeStackError,
  type StackProblem,
  shapeProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import {
  type DiffFacts,
  placedHunks,
} from '@change-review/domain/services/diff-facts';
import { factProblems } from '@change-review/domain/services/fact-rules';
import { withMovedCodeTogether } from '@change-review/domain/services/moved-code';
import {
  cohortHeaderProblems,
  StackProposal,
} from '@change-review/domain/services/stack-proposal';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import type {
  OutlinedCohort,
  ProposedCohort,
  ProposedLayer,
  StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

export interface StackPart {
  readonly diff: Diff;
  readonly facts: DiffFacts;
}

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

const shapeProblems = (
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
    cohorts: readonly OutlinedCohort[];
  }): OutlinedCohort[] {
    const cohorts = withoutIncidental(input.facts, input.cohorts);
    const problems = [
      ...shapeProblems(input.diff, input.facts, cohorts),
      ...factProblems(cohorts.map(asOneLayer), input.facts),
    ];

    if (problems.length > 0) {
      throw new InvalidChangeStackError(problems);
    }

    return cohorts.map((cohort) => ({
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

  partOf(diff: Diff, facts: DiffFacts, hunks: readonly HunkId[]): StackPart {
    const within = new Set<string>(hunks);
    const files = diff.files.flatMap((file) => {
      const kept = file.hunks.filter((hunk) => within.has(hunk.id));
      return kept.length > 0 ? [{ ...file, hunks: kept }] : [];
    });
    const paths = new Set(files.map((file) => file.path));

    return {
      diff: Diff.of(files),
      facts: {
        hunks: facts.hunks.filter((each) => within.has(each.hunk)),
        links: facts.links.filter(
          (link) => within.has(link.from) && within.has(link.to),
        ),
        imports: facts.imports.filter(
          (each) => paths.has(each.from) && paths.has(each.to),
        ),
      },
    };
  },

  layered(
    part: StackPart,
    cohort: OutlinedCohort,
    layers: readonly ProposedLayer[],
  ): ProposedCohort {
    const { hunks: _, ...outlined } = cohort;
    const [layered = { ...outlined, layers }] = withMovedCodeTogether(
      part.diff,
      part.facts,
      [{ ...outlined, layers }],
    );

    StackProposal.validate({
      diff: part.diff,
      facts: part.facts,
      cohorts: [layered],
    });

    return layered;
  },
};
