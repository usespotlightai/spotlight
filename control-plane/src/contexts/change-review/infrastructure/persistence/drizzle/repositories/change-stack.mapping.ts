import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import {
  type CheckEntry,
  type CheckedStep,
  StackCheck,
  type StepId,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
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
  StoredStackCheck,
  StoredStep,
} from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.rows';

const stepOf = (raw: string): StepId =>
  raw === WHOLE_STEP ? WHOLE_STEP : LayerId.of(raw);

const checkedStepOf = (stored: StoredStep): CheckedStep => ({
  step: stepOf(stored.step),
  passed: stored.passed,
  output: stored.output,
  tookMs: stored.tookMs,
});

const entryOf = (stored: { hunk: string; layer: string }): CheckEntry => ({
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

export const checkOf = (stored: StoredStackCheck | null): StackCheck | null =>
  stored &&
  StackCheck.rehydrate({
    command: stored.command,
    phase: stored.phase,
    entries: (stored.entries ?? []).map(entryOf),
    rounds: stored.rounds ?? 0,
    outcome: stored.outcome && {
      state: stored.outcome.state,
      reason: stored.outcome.reason,
      whole: stored.outcome.whole && checkedStepOf(stored.outcome.whole),
      layers: stored.outcome.layers.map(checkedStepOf),
      checkedAt: new Date(stored.outcome.checkedAt),
    },
  });

export const progressOf = (row: {
  state: ChangeStackState;
  failure: string | null;
  draftedAt: Date;
  settledAt: Date | null;
  check: StoredStackCheck | null;
}): StackProgress =>
  StackProgress.rehydrate({
    state: row.state,
    failure: row.failure,
    draftedAt: row.draftedAt,
    settledAt: row.settledAt,
    check: checkOf(row.check),
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

export const checkRow = (check: StackCheck | null): StoredStackCheck | null =>
  check && {
    command: check.command,
    phase: check.phase,
    entries: check.entries.map((entry) => ({ ...entry })),
    rounds: check.rounds,
    outcome: check.outcome && {
      state: check.outcome.state,
      reason: check.outcome.reason,
      whole: check.outcome.whole && { ...check.outcome.whole },
      layers: check.outcome.layers.map((each) => ({ ...each })),
      checkedAt: check.outcome.checkedAt.toISOString(),
    },
  };
