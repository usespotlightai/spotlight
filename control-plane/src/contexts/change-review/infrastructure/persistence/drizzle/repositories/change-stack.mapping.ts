import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type {
  CheckEntry,
  CheckedStep,
  StepId,
} from '@change-review/domain/value-objects/stack-check.vo';
import { WHOLE_STEP } from '@change-review/domain/value-objects/stack-check.vo';
import type { StackCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import {
  CohortId,
  HunkId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';
import {
  type ChangeStackState,
  StackProgress,
} from '@change-review/domain/value-objects/stack-progress.vo';
import type {
  StoredCohort,
  StoredFacts,
  StoredFile,
  StoredStep,
} from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.rows';

const stepOf = (raw: string): StepId =>
  raw === WHOLE_STEP ? WHOLE_STEP : LayerId.of(raw);

export const checkedStepOf = (stored: StoredStep): CheckedStep => ({
  step: stepOf(stored.step),
  passed: stored.passed,
  output: stored.output,
  tookMs: stored.tookMs,
});

export const entryOf = (stored: {
  hunk: string;
  layer: string;
}): CheckEntry => ({
  hunk: HunkId.of(stored.hunk),
  layer: LayerId.of(stored.layer),
});

export const diffOf = (files: readonly StoredFile[]): Diff =>
  Diff.of(
    files.map((file) => ({
      path: file.path,
      previousPath: file.previousPath,
      status: file.status,
      binary: file.binary,
      hunks: file.hunks.map((hunk) => ({ ...hunk, id: HunkId.of(hunk.id) })),
    })),
  );

export const factsOf = (stored: StoredFacts): StackFacts =>
  StackFacts.of({
    hunks: stored.hunks.map((each) => ({
      ...each,
      hunk: HunkId.of(each.hunk),
    })),
    links: stored.links.map((each) => ({
      ...each,
      from: HunkId.of(each.from),
      to: HunkId.of(each.to),
    })),
    imports: stored.imports.map((each) => ({ ...each })),
  });

export const cohortsOf = (
  stored: readonly StoredCohort[],
): readonly StackCohort[] =>
  stored.map((cohort) => ({
    id: CohortId.of(cohort.id),
    kind: cohort.kind,
    title: cohort.title,
    intent: cohort.intent,
    layers: cohort.layers.map((layer) => ({
      id: LayerId.of(layer.id),
      title: layer.title,
      summary: layer.summary,
      dependsOn: layer.dependsOn.map((each) => ({
        layer: LayerId.of(each.layer),
        because: [...each.because],
      })),
      ranges: layer.ranges.map((range) => ({ hunk: HunkId.of(range.hunk) })),
      notes: layer.notes.map((note) => ({ ...note })),
    })),
  }));

export const progressOf = (row: {
  state: ChangeStackState;
  failure: string | null;
  draftedAt: Date;
  completedAt: Date | null;
}): StackProgress =>
  StackProgress.rehydrate({
    state: row.state,
    failure: row.failure,
    draftedAt: row.draftedAt,
    completedAt: row.completedAt,
  });

export const fileRows = (files: readonly DiffFile[]): StoredFile[] =>
  files.map((file) => ({
    path: file.path,
    previousPath: file.previousPath,
    status: file.status,
    binary: file.binary,
    hunks: file.hunks.map((hunk) => ({ ...hunk })),
  }));

export const factRows = (facts: DiffFacts): StoredFacts => ({
  hunks: facts.hunks.map((each) => ({ ...each })),
  links: facts.links.map((each) => ({ ...each })),
  imports: facts.imports.map((each) => ({ ...each })),
});

export const cohortRows = (cohorts: readonly StackCohort[]): StoredCohort[] =>
  cohorts.map((cohort) => ({
    ...cohort,
    layers: cohort.layers.map((layer) => ({
      ...layer,
      dependsOn: layer.dependsOn.map((each) => ({ ...each })),
      ranges: layer.ranges.map((range) => ({ ...range })),
      notes: layer.notes.map((note) => ({ ...note })),
    })),
  }));
