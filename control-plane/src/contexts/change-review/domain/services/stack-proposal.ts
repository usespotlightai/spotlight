import {
  InvalidChangeStackError,
  type StackProblem,
  shapeProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import {
  derivedDependencies,
  factProblems,
} from '@change-review/domain/services/fact-rules';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import {
  type LayerDependency,
  needsFileNotes,
  type ProposedCohort,
  type ProposedLayer,
  type StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import {
  CohortId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';

const MAX_TITLE = 120;

const MAX_PROSE = 2_000;

const noteProblems = (
  diff: Diff,
  layer: ProposedLayer,
  at: string,
  required: boolean,
): string[] => {
  const problems: string[] = [];
  const touched = new Set(
    layer.ranges.flatMap((range) => {
      const file = diff.fileOf(range.hunk);
      return file ? [file.path] : [];
    }),
  );
  const noted = new Map<string, number>();

  for (const { path, note } of layer.notes) {
    noted.set(path, (noted.get(path) ?? 0) + 1);

    if (!touched.has(path)) {
      problems.push(`${at} notes ${path}, which none of its changes touch`);
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
        problems.push(`${at} gives no note on ${path}`);
      }
    }
  }

  return problems;
};

const shapeProblems = (
  diff: Diff,
  cohorts: readonly ProposedCohort[],
): StackProblem[] => {
  const problems: string[] = [];
  const known = new Set(diff.hunks.map((hunk) => hunk.id));
  const placed = new Map<string, number>();

  if (cohorts.length === 0) {
    problems.push('has no cohorts');
  }

  cohorts.forEach((cohort, c) => {
    const where = `cohort ${c + 1}`;

    if (!cohort.title.trim() || cohort.title.length > MAX_TITLE) {
      problems.push(
        `${where} needs a title of at most ${MAX_TITLE} characters`,
      );
    }
    if (!cohort.intent.trim() || cohort.intent.length > MAX_PROSE) {
      problems.push(
        `${where} needs an intent of at most ${MAX_PROSE} characters`,
      );
    }
    if (cohort.layers.length === 0) {
      problems.push(`${where} has no layers`);
    }

    cohort.layers.forEach((layer, l) => {
      const at = `${where}, layer ${l + 1}`;

      if (!layer.title.trim() || layer.title.length > MAX_TITLE) {
        problems.push(`${at} needs a title of at most ${MAX_TITLE} characters`);
      }
      if (!layer.summary.trim() || layer.summary.length > MAX_PROSE) {
        problems.push(
          `${at} needs a summary of at most ${MAX_PROSE} characters`,
        );
      }
      if (layer.ranges.length === 0) {
        problems.push(`${at} has no changes`);
      }

      for (const range of layer.ranges) {
        if (!known.has(range.hunk)) {
          problems.push(`${at} names ${range.hunk}, which is not in the diff`);
        } else {
          placed.set(range.hunk, (placed.get(range.hunk) ?? 0) + 1);
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
  });

  for (const hunk of known) {
    const times = placed.get(hunk) ?? 0;

    if (times === 0) {
      problems.push(`leaves ${hunk} out`);
    } else if (times > 1) {
      problems.push(`places ${hunk} ${times} times`);
    }
  }

  return problems.map(shapeProblem);
};

const mergedDependencies = (
  cohortId: CohortId,
  proposed: ProposedLayer['dependsOn'],
  derived: ReadonlyMap<number, ReadonlySet<string>> | undefined,
): LayerDependency[] => {
  const merged = new Map<number, Set<string>>();

  for (const dependency of proposed) {
    const symbols = merged.get(dependency.layer) ?? new Set<string>();

    for (const symbol of dependency.because) {
      if (symbol.trim()) {
        symbols.add(symbol.trim());
      }
    }
    merged.set(dependency.layer, symbols);
  }

  for (const [layer, because] of derived ?? []) {
    const symbols = merged.get(layer) ?? new Set<string>();

    for (const symbol of because) {
      symbols.add(symbol);
    }
    merged.set(layer, symbols);
  }

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
      layers: cohort.layers.map((layer, l) => ({
        id: LayerId.in(cohortId, l + 1),
        title: layer.title.trim(),
        summary: layer.summary.trim(),
        dependsOn: mergedDependencies(
          cohortId,
          layer.dependsOn,
          derived.get(`${c}.${l}`),
        ),
        ranges: layer.ranges.map((range) => ({ hunk: range.hunk })),
        notes: layer.notes.map((each) => ({
          path: each.path,
          note: each.note.trim(),
        })),
      })),
    };
  });
};

export const StackProposal = {
  settle(input: {
    diff: Diff;
    facts: DiffFacts;
    cohorts: readonly ProposedCohort[];
    also?: readonly StackProblem[];
  }): StackCohort[] {
    const problems = [
      ...shapeProblems(input.diff, input.cohorts),
      ...factProblems(input.cohorts, input.facts),
      ...(input.also ?? []),
    ];

    if (problems.length > 0) {
      throw new InvalidChangeStackError(problems);
    }

    return numbered(input.cohorts, input.facts);
  },
};
