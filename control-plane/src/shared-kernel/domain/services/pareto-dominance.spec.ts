import { dominates } from '@shared-kernel/domain/services/pareto-dominance';
import { describe, expect, it } from 'vitest';

describe('dominates', () => {
  it('takes a point that is as good and cheaper, or better at the same cost, over another', () => {
    expect(dominates({ cost: 1, value: 5 }, { cost: 2, value: 5 }, true)).toBe(
      true,
    );
    expect(dominates({ cost: 1, value: 6 }, { cost: 1, value: 5 }, true)).toBe(
      true,
    );
    expect(dominates({ cost: 1, value: 5 }, { cost: 1, value: 5 }, true)).toBe(
      false,
    );
    expect(dominates({ cost: 1, value: 6 }, { cost: 0, value: 5 }, true)).toBe(
      false,
    );
  });

  it('reads a lower value as better when lower is better', () => {
    expect(dominates({ cost: 1, value: 4 }, { cost: 1, value: 5 }, false)).toBe(
      true,
    );
    expect(dominates({ cost: 1, value: 6 }, { cost: 1, value: 5 }, false)).toBe(
      false,
    );
  });
});
