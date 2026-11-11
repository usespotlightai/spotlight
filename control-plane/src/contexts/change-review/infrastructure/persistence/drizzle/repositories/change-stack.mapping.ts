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
import type {
  LayerRevision,
  RemovedLayer,
  StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import {
  CohortId,
  HunkId,
  LayerId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';
import {
  type ChangeStackState,
  type StackFailure,
  StackProgress,
} from '@change-review/domain/value-objects/stack-progress.vo';
import type {
  StoredCohort,
  StoredFacts,
  StoredFile,
  StoredRemovedLayer,
  StoredStep,
} from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.rows';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const stepOf = (raw: string): StepId =>
  raw === WHOLE_STEP ? WHOLE_STEP : LayerId.of(raw);

export const checkedStepOf = (stored: StoredStep): CheckedStep => ({
  step: stepOf(stored.step),
  passed: stored.passed,
  output: stored.output,
  durationMs: stored.durationMs,
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

const revisionOf = (
  stored: NonNullable<StoredCohort['layers'][number]['revision']>,
): LayerRevision => {
  if (stored.status === 'added') {
    return { status: 'added' };
  }
  if (!stored.previous) {
    throw new InconsistentStateError(
      'change stack',
      `has a layer ${stored.status} without the layer it follows`,
    );
  }

  return { status: stored.status, previous: LayerId.of(stored.previous) };
};

export const removedOf = (
  stored: readonly StoredRemovedLayer[],
): RemovedLayer[] =>
  stored.map((each) => ({
    previous: LayerId.of(each.previous),
    cohort: each.cohort,
    title: each.title,
  }));

export const cohortsOf = (
  stored: readonly StoredCohort[],
): readonly StackCohort[] =>
  stored.map((cohort) => ({
    id: CohortId.of(cohort.id),
    kind: cohort.kind,
    title: cohort.title,
    intent: cohort.intent,
    joinedBecause: cohort.joinedBecause,
    layers: cohort.layers.map((layer) => ({
      id: LayerId.of(layer.id),
      title: layer.title,
      summary: layer.summary,
      dependsOn: layer.dependsOn.map((each) => ({
        layer: LayerId.of(each.layer),
        because: [...each.because],
      })),
      hunks: layer.hunks.map((entry) => ({ hunk: HunkId.of(entry.hunk) })),
      notes: layer.notes.map((note) => ({ ...note })),
      questions: (layer.questions ?? []).map((each) => ({
        id: QuestionId.of(each.id),
        question: each.question,
        answer: each.answer,
        hunks: each.hunks.map((hunk) => HunkId.of(hunk)),
      })),
      revision: layer.revision ? revisionOf(layer.revision) : null,
    })),
  }));

export const progressOf = (row: {
  state: ChangeStackState;
  failure: StackFailure | null;
  startedAt: Date;
  completedAt: Date | null;
}): StackProgress =>
  StackProgress.rehydrate({
    state: row.state,
    failure: row.failure,
    startedAt: row.startedAt,
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
      hunks: layer.hunks.map((entry) => ({ ...entry })),
      notes: layer.notes.map((note) => ({ ...note })),
      questions: layer.questions.map((each) => ({
        ...each,
        hunks: [...each.hunks],
      })),
      revision: layer.revision && { ...layer.revision },
    })),
  }));
