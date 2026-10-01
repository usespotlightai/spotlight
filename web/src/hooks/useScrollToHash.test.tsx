import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollToHash } from '@/hooks/useScrollToHash';

const at =
  (path: string) =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  );

describe('useScrollToHash', () => {
  const scrolled = vi.fn();
  let target: HTMLElement;

  beforeEach(() => {
    target = document.createElement('div');
    target.id = 'station-one';
    target.scrollIntoView = scrolled;
    document.body.append(target);
  });

  afterEach(() => {
    target.remove();
    scrolled.mockReset();
  });

  it('scrolls to the element the hash names once it is shown', () => {
    const { rerender } = renderHook(({ shown }) => useScrollToHash(shown), {
      initialProps: { shown: false },
      wrapper: at('/insights#station-one'),
    });
    expect(scrolled).not.toHaveBeenCalled();

    rerender({ shown: true });

    expect(scrolled).toHaveBeenCalledWith({ block: 'center' });
  });

  it('scrolls nowhere for a hash it cannot read', () => {
    expect(() =>
      renderHook(() => useScrollToHash(true), {
        wrapper: at('/insights#%E0%A4%A'),
      }),
    ).not.toThrow();
    expect(scrolled).not.toHaveBeenCalled();
  });
});
