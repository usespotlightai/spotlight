import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCommandShortcut } from '@/hooks/useCommandShortcut';

const press = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { cancelable: true, ...init });
  document.dispatchEvent(event);

  return event;
};

describe('useCommandShortcut', () => {
  it('toggles on Command K and keeps the browser from acting on it', () => {
    const onToggle = vi.fn();
    renderHook(() => useCommandShortcut(onToggle));

    const event = press({ key: 'k', metaKey: true });

    expect(onToggle).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves other keys to the page', () => {
    const onToggle = vi.fn();
    renderHook(() => useCommandShortcut(onToggle));

    const event = press({ key: 'k', ctrlKey: true, shiftKey: true });
    press({ key: 'j', metaKey: true });

    expect(onToggle).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops listening once unmounted', () => {
    const onToggle = vi.fn();
    const { unmount } = renderHook(() => useCommandShortcut(onToggle));

    unmount();
    press({ key: 'k', metaKey: true });

    expect(onToggle).not.toHaveBeenCalled();
  });
});
