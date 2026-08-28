import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDragGuard } from '@/hooks/useDragGuard';

const click = () => {
  const navigate = vi.fn();
  const link = document.createElement('a');
  link.addEventListener('click', navigate);
  document.body.append(link);
  link.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true }),
  );
  link.remove();
  return navigate;
};

describe('useDragGuard', () => {
  it('swallows the click that follows a drop', () => {
    const { result } = renderHook(() => useDragGuard());
    result.current();

    expect(click()).not.toHaveBeenCalled();
  });

  it('lets the click after that through', () => {
    const { result } = renderHook(() => useDragGuard());
    result.current();
    click();

    expect(click()).toHaveBeenCalled();
  });

  it('leaves clicks alone when nothing was dragged', () => {
    renderHook(() => useDragGuard());

    expect(click()).toHaveBeenCalled();
  });

  it('lets go of the click it was waiting for when unmounted', () => {
    const { result, unmount } = renderHook(() => useDragGuard());
    result.current();
    unmount();

    expect(click()).toHaveBeenCalled();
  });
});
