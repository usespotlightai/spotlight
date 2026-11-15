import {
  HELD_OUT_SHARE,
  revisionSplitOf,
} from '@insights/domain/services/revision-split';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const runs = Array.from({ length: 400 }, (_, at) => ({
  runId: RunId.of(`run_${at}`),
}));

describe('revisionSplitOf', () => {
  it('holds out about 30% of the runs and searches the rest', () => {
    const split = revisionSplitOf(runs);

    expect(split.searched.length + split.heldOut.length).toBe(runs.length);
    expect(split.heldOut.length / runs.length).toBeGreaterThan(
      HELD_OUT_SHARE - 0.07,
    );
    expect(split.heldOut.length / runs.length).toBeLessThan(
      HELD_OUT_SHARE + 0.07,
    );
  });

  it('puts a run on the same side every time, whatever the other runs are', () => {
    const heldOut = revisionSplitOf(runs).heldOut.map(
      (each) => each.runId.value,
    );
    const again = revisionSplitOf(
      [...runs].reverse().slice(0, 200),
    ).heldOut.map((each) => each.runId.value);

    expect(again.every((each) => heldOut.includes(each))).toBe(true);
  });
});
