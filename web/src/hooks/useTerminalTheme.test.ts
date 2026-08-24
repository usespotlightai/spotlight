import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTerminalTheme } from '@/hooks/useTerminalTheme';

const paint = (tokens: Record<string, string>) => {
  for (const [name, value] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(name, value);
  }
};

const LIGHT = { '--background': '#f8f8f9', '--foreground': '#2f2f31' };
const DARK = { '--background': '#0d0d0e', '--foreground': '#e2e3e5' };

const listeners = new Set<() => void>();

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  addEventListener: (_: string, listener: () => void) =>
    listeners.add(listener),
  removeEventListener: (_: string, listener: () => void) =>
    listeners.delete(listener),
}));

const schemeChanged = () =>
  act(() => {
    for (const fire of listeners) {
      fire();
    }
  });

afterEach(() => {
  document.documentElement.removeAttribute('style');
  listeners.clear();
});

describe('useTerminalTheme', () => {
  it('paints the terminal with the page’s own tokens', () => {
    paint(LIGHT);

    const { result } = renderHook(() => useTerminalTheme());

    expect(result.current.background).toBe('#f8f8f9');
    expect(result.current.foreground).toBe('#2f2f31');
  });

  it('follows the page when the appearance changes', () => {
    paint(LIGHT);
    const { result } = renderHook(() => useTerminalTheme());

    paint(DARK);
    schemeChanged();

    expect(result.current.background).toBe('#0d0d0e');
    expect(result.current.foreground).toBe('#e2e3e5');
  });

  // The change event has been seen not to fire while the query already reports
  // the new value, stranding the terminal in the old appearance.
  it('catches up on returning to the page when no change event arrived', () => {
    paint(LIGHT);
    const { result } = renderHook(() => useTerminalTheme());

    paint(DARK);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current.background).toBe('#0d0d0e');
  });

  it('holds the same object while the appearance is unchanged', () => {
    paint(DARK);
    const { result } = renderHook(() => useTerminalTheme());
    const first = result.current;

    schemeChanged();

    expect(result.current).toBe(first);
  });

  it('keeps the cursor legible against whichever background it is on', () => {
    paint(DARK);

    const { result } = renderHook(() => useTerminalTheme());

    expect(result.current.cursor).toBe(result.current.foreground);
    expect(result.current.cursorAccent).toBe(result.current.background);
  });
});
