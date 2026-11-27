import { samplePointOf } from '@insights/domain/services/judge-sampling';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const MAX_LABELLED_RUNS = 50;

export const HELD_OUT_SHARE = 0.3;

export const MIN_HELD_OUT = 3;

export interface RevisionSplit<T> {
  readonly searched: readonly T[];
  readonly heldOut: readonly T[];
}

export const revisionSplitOf = <T extends { readonly runId: RunId }>(
  runs: readonly T[],
): RevisionSplit<T> => ({
  searched: runs.filter(
    (each) => samplePointOf('revision', each.runId) >= HELD_OUT_SHARE,
  ),
  heldOut: runs.filter(
    (each) => samplePointOf('revision', each.runId) < HELD_OUT_SHARE,
  ),
});

export const revisableOf = <T>(split: RevisionSplit<T>): boolean =>
  split.heldOut.length >= MIN_HELD_OUT;
