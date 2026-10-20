import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useArrivals } from '@/hooks/useArrivals';

describe('useArrivals', () => {
  it('lets only what came after the first render arrive', () => {
    const { result, rerender } = renderHook(
      ({ present }) => useArrivals('item_1', present),
      { initialProps: { present: [0, 1] } },
    );

    rerender({ present: [0, 1, 2] });

    expect(result.current(0)).toBe(false);
    expect(result.current(1)).toBe(false);
    expect(result.current(2)).toBe(true);
  });

  it('starts again for another item, so its notes do not arrive', () => {
    const { result, rerender } = renderHook(
      ({ scope, present }) => useArrivals(scope, present),
      { initialProps: { scope: 'item_1', present: [0, 1] } },
    );

    rerender({ scope: 'item_2', present: [0, 1, 2, 3] });

    expect(result.current(3)).toBe(false);

    rerender({ scope: 'item_2', present: [0, 1, 2, 3, 4] });

    expect(result.current(4)).toBe(true);
  });
});
