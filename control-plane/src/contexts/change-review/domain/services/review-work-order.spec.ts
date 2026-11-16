import type { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { reviewWorkOrder } from '@change-review/domain/services/review-work-order';
import { describe, expect, it } from 'vitest';

const diff = (id: string) => ({ id }) as unknown as PushDiff;
const check = (id: string) => ({ id }) as unknown as StackCheck;

describe('reviewWorkOrder', () => {
  it('puts every push diff before any check, each in the order given', () => {
    const diffs = [diff('diff_1'), diff('diff_2')];
    const checks = [check('check_1'), check('check_2')];

    expect(reviewWorkOrder(diffs, checks)).toEqual([
      { kind: 'diff', diff: diffs[0] },
      { kind: 'diff', diff: diffs[1] },
      { kind: 'check', check: checks[0] },
      { kind: 'check', check: checks[1] },
    ]);
  });

  it('orders checks alone when no push diff waits', () => {
    const checks = [check('check_1')];

    expect(reviewWorkOrder([], checks)).toEqual([
      { kind: 'check', check: checks[0] },
    ]);
  });
});
