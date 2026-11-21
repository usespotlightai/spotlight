import type { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import {
  precedes,
  placeOf,
  reviewWorkOrder,
} from '@change-review/domain/services/review-work-order';
import { describe, expect, it } from 'vitest';

const at = (minute: number) => new Date(Date.UTC(2026, 10, 21, 9, minute, 0));

const diff = (id: string, minute: number) =>
  ({ id: { value: id }, recordedAt: at(minute) }) as unknown as PushDiff;

const check = (stackId: string, minute: number, recheck = false) =>
  ({
    stackId: { value: stackId },
    recheck,
    waitingSince: at(minute),
  }) as unknown as StackCheck;

describe('reviewWorkOrder', () => {
  it('puts every push diff before any check, each kind by its time', () => {
    const diffs = [diff('diff_2', 5), diff('diff_1', 1)];
    const checks = [check('stack_2', 0), check('stack_1', 3)];

    expect(reviewWorkOrder(diffs, checks)).toEqual([
      { kind: 'diff', diff: diffs[1] },
      { kind: 'diff', diff: diffs[0] },
      { kind: 'check', check: checks[0] },
      { kind: 'check', check: checks[1] },
    ]);
  });

  it('orders items of the same time by their id, and a first check before its recheck', () => {
    const diffs = [diff('diff_b', 1), diff('diff_a', 1)];
    const checks = [check('stack_1', 2, true), check('stack_1', 2)];

    expect(reviewWorkOrder(diffs, checks)).toEqual([
      { kind: 'diff', diff: diffs[1] },
      { kind: 'diff', diff: diffs[0] },
      { kind: 'check', check: checks[1] },
      { kind: 'check', check: checks[0] },
    ]);
  });

  it('orders checks alone when no push diff waits', () => {
    const checks = [check('stack_1', 0)];

    expect(reviewWorkOrder([], checks)).toEqual([
      { kind: 'check', check: checks[0] },
    ]);
  });
});

describe('precedes', () => {
  it('places an item that left the order where it stood, so a cursor at it still works', () => {
    const place = placeOf({ kind: 'check', check: check('stack_2', 2) });

    expect(
      precedes(place, placeOf({ kind: 'check', check: check('stack_3', 2) })),
    ).toBe(true);
    expect(
      precedes(place, placeOf({ kind: 'check', check: check('stack_1', 2) })),
    ).toBe(false);
    expect(
      precedes(place, placeOf({ kind: 'diff', diff: diff('diff_1', 9) })),
    ).toBe(false);
  });

  it('never puts a place before itself, so the item at a cursor is not read again', () => {
    const place = placeOf({ kind: 'check', check: check('stack_2', 2) });

    expect(precedes(place, place)).toBe(false);
  });

  it('puts a first check before its recheck at the same time', () => {
    expect(
      precedes(
        placeOf({ kind: 'check', check: check('stack_1', 2) }),
        placeOf({ kind: 'check', check: check('stack_1', 2, true) }),
      ),
    ).toBe(true);
  });
});
