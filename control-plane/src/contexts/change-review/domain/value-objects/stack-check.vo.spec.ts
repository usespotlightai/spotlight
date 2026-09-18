import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import {
  type CheckOutcome,
  StackCheck,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-16T10:00:00Z');

const outcome = (layerPasses: boolean, wholePasses = true): CheckOutcome => ({
  state: 'checked',
  reason: null,
  whole: { step: WHOLE_STEP, passed: wholePasses, output: '', tookMs: 1 },
  layers: [
    { step: LayerId.of('c1.l1'), passed: layerPasses, output: '', tookMs: 1 },
  ],
  checkedAt: NOW,
});

describe('StackCheck', () => {
  it('names a command of one short line, and waits', () => {
    expect(StackCheck.named(' go build ./... ')).toMatchObject({
      command: 'go build ./...',
      phase: 'waiting',
      rounds: 0,
      outcome: null,
    });
    expect(() => StackCheck.named('a\nb')).toThrow(InvalidChangeStackError);
    expect(() => StackCheck.named('')).toThrow(InvalidChangeStackError);
  });

  it('reorders once where the whole change builds and a layer does not', () => {
    const reordering = StackCheck.named('tsc').found(outcome(false));

    expect(reordering.phase).toBe('reordering');
    expect(reordering.reordered([]).found(outcome(false)).phase).toBe(
      'checked',
    );
    expect(StackCheck.named('tsc').found(outcome(true)).phase).toBe('checked');
    expect(StackCheck.named('tsc').found(outcome(false, false)).phase).toBe(
      'checked',
    );
  });

  it('keeps its layers, or takes reordered ones, only while reordering', () => {
    const reordering = StackCheck.named('tsc').found(outcome(false));

    expect(reordering.keptLayers()).toMatchObject({ phase: 'checked' });
    expect(
      reordering.reordered([
        { hunk: HunkId.of('h1'), layer: LayerId.of('c1.l1') },
      ]),
    ).toMatchObject({
      phase: 'waiting',
      rounds: 1,
      outcome: null,
    });
    expect(() => StackCheck.named('tsc').keptLayers()).toThrow(
      InvalidChangeStackError,
    );
    expect(() => reordering.found(outcome(true))).toThrow(
      InvalidChangeStackError,
    );
  });

  it('refuses a stored check whose phase and outcome disagree', () => {
    const stored = {
      command: 'tsc',
      entries: [],
      rounds: 0,
    };

    expect(() =>
      StackCheck.rehydrate({
        ...stored,
        phase: 'waiting',
        outcome: outcome(true),
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      StackCheck.rehydrate({ ...stored, phase: 'reordering', outcome: null }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      StackCheck.rehydrate({
        ...stored,
        phase: 'checked',
        rounds: -1,
        outcome: outcome(true),
      }),
    ).toThrow(InconsistentStateError);
  });
});
