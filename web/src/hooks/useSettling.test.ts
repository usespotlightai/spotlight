import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSettling } from '@/hooks/useSettling';
import { SPRING_MS } from '@/lib/motion';

describe('useSettling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles a spring after it starts', () => {
    const settled = vi.fn();
    const { result } = renderHook(() => useSettling<string>(settled));

    act(() => result.current[1]('open'));
    act(() => {
      vi.advanceTimersByTime(SPRING_MS);
    });

    expect(settled).toHaveBeenCalledWith('open');
    expect(result.current[0]).toBeNull();
  });

  it('waits a whole spring again when the same value settles again', () => {
    const settled = vi.fn();
    const { result } = renderHook(() => useSettling<string>(settled));

    act(() => result.current[1]('open'));
    act(() => {
      vi.advanceTimersByTime(SPRING_MS - 50);
    });
    act(() => result.current[1]('open'));
    act(() => {
      vi.advanceTimersByTime(SPRING_MS - 50);
    });

    expect(settled).not.toHaveBeenCalled();
    expect(result.current[0]).toBe('open');

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(settled).toHaveBeenCalledTimes(1);
  });
});
