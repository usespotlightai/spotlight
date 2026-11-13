import {
  type StackProblem,
  shapeProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import { factProblems } from '@change-review/domain/services/fact-rules';
import { placementsOf } from '@change-review/domain/services/hunk-placements';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import {
  type CohortKind,
  MAX_PROSE,
  needsFileNotes,
  type ProposedCohort,
  type ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';

const MAX_TITLE = 120;

export const cohortHeaderProblems = (
  cohort: { readonly title: string; readonly intent: string },
  where: string,
): string[] => [
  ...(!cohort.title.trim() || cohort.title.length > MAX_TITLE
    ? [`${where} needs a title of at most ${MAX_TITLE} characters`]
    : []),
  ...(!cohort.intent.trim() || cohort.intent.length > MAX_PROSE
    ? [`${where} needs an intent of at most ${MAX_PROSE} characters`]
    : []),
];

const noteProblems = (
  diff: Diff,
  layer: ProposedLayer,
  at: string,
  required: boolean,
): string[] => {
  const problems: string[] = [];
  const touched = diff.pathsOf(layer.hunks.map((entry) => entry.hunk));
  const noted = new Map<string, number>();

  for (const { path, note } of layer.notes) {
    noted.set(path, (noted.get(path) ?? 0) + 1);

    if (!touched.has(path)) {
      problems.push(`${at} notes ${path}, which none of its hunks touch`);
    } else if (!note.trim() || note.length > MAX_PROSE) {
      problems.push(
        `${at} needs a note on ${path} of at most ${MAX_PROSE} characters`,
      );
    }
  }

  for (const [path, times] of noted) {
    if (times > 1) {
      problems.push(`${at} notes ${path} ${times} times`);
    }
  }

  if (required) {
    for (const path of touched) {
      if (!noted.has(path)) {
        problems.push(`${at} has no note on ${path}`);
      }
    }
  }

  return problems;
};

export const layerNoteProblems = (
  diff: Diff,
  layer: ProposedLayer,
  at: string,
): string[] => noteProblems(diff, layer, at, true);

const layerProblems = (
  diff: Diff,
  cohort: ProposedCohort,
  where: string,
): string[] => {
  const problems: string[] = [...cohortHeaderProblems(cohort, where)];
  const known = new Set<string>(diff.hunks.map((hunk) => hunk.id));

  if (cohort.layers.length === 0) {
    problems.push(`${where} has no layers`);
  }

  cohort.layers.forEach((layer, l) => {
    const at = `${where}, layer ${l + 1}`;

    if (!layer.title.trim() || layer.title.length > MAX_TITLE) {
      problems.push(`${at} needs a title of at most ${MAX_TITLE} characters`);
    }
    if (!layer.summary.trim() || layer.summary.length > MAX_PROSE) {
      problems.push(`${at} needs a summary of at most ${MAX_PROSE} characters`);
    }
    if (layer.hunks.length === 0) {
      problems.push(`${at} has no hunks`);
    }

    for (const entry of layer.hunks) {
      if (!known.has(entry.hunk)) {
        problems.push(`${at} names ${entry.hunk}, which is not in the diff`);
      }
    }

    problems.push(
      ...noteProblems(diff, layer, at, needsFileNotes(cohort.kind)),
    );

    for (const dependency of layer.dependsOn) {
      if (
        !Number.isInteger(dependency.layer) ||
        dependency.layer < 1 ||
        dependency.layer > l
      ) {
        problems.push(
          `${at} depends on layer ${dependency.layer}, but a layer only depends on an earlier layer of its own cohort`,
        );
      }
      if (dependency.because.every((symbol) => !symbol.trim())) {
        problems.push(
          `${at} depends on layer ${dependency.layer} without naming what it uses from it`,
        );
      }
    }
  });

  return problems;
};

const timesAssigned = (
  cohorts: readonly ProposedCohort[],
): Map<string, number> =>
  new Map(
    [...placementsOf(cohorts)].map(([hunk, placements]) => [
      hunk,
      placements.length,
    ]),
  );

const cohortShapeProblems = (
  diff: Diff,
  cohort: ProposedCohort,
): StackProblem[] =>
  [
    ...layerProblems(diff, cohort, 'this cohort'),
    ...[...timesAssigned([cohort])].flatMap(([hunk, times]) =>
      times > 1 ? [`assigns ${hunk} ${times} times`] : [],
    ),
  ].map(shapeProblem);

export const cohortProblems = (
  diff: Diff,
  facts: DiffFacts,
  cohort: ProposedCohort,
): StackProblem[] => [
  ...cohortShapeProblems(diff, cohort),
  ...factProblems([cohort], facts),
];

export const shapeProblems = (
  diff: Diff,
  cohorts: readonly ProposedCohort[],
): StackProblem[] => {
  const problems = cohorts.length === 0 ? ['has no cohorts'] : [];
  const assigned = timesAssigned(cohorts);

  cohorts.forEach((cohort, c) => {
    problems.push(...layerProblems(diff, cohort, `cohort ${c + 1}`));
  });

  for (const hunk of diff.hunks.map((each) => each.id)) {
    const times = assigned.get(hunk) ?? 0;

    if (times === 0) {
      problems.push(`leaves ${hunk} out`);
    } else if (times > 1) {
      problems.push(`assigns ${hunk} ${times} times`);
    }
  }

  return problems.map(shapeProblem);
};

export const changeLayerCount = (
  cohorts: readonly {
    readonly kind: CohortKind;
    readonly layers: readonly unknown[];
  }[],
): number =>
  cohorts
    .filter((cohort) => cohort.kind === 'change')
    .reduce((total, cohort) => total + cohort.layers.length, 0);

export const layerCountProblems = (
  cohorts: readonly ProposedCohort[],
  atLeast: number | undefined,
): StackProblem[] => {
  const count = changeLayerCount(cohorts);

  return atLeast !== undefined && count < atLeast
    ? [
        {
          code: 'joined-layers',
          message: `joins layers, leaving ${count} where there were ${atLeast}`,
        },
      ]
    : [];
};
