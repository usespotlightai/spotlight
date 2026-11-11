import { readFileSync } from 'node:fs';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_STORAGE_KEY, useTheme } from '@/hooks/useTheme';

const media = { matches: false, listeners: new Set<() => void>() };

const prefer = (dark: boolean) => {
  media.matches = dark;
  for (const listener of media.listeners) {
    listener();
  }
};

const isDark = () => document.documentElement.classList.contains('dark');

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  media.matches = false;
  media.listeners.clear();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return media.matches;
    },
    addEventListener: (_: string, listener: () => void) =>
      media.listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      media.listeners.delete(listener),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTheme', () => {
  it('tells the desktop app the chosen theme, so that its window follows', () => {
    const setTheme = vi.fn();
    Object.assign(window, {
      spotlightDesktop: {
        platform: 'darwin',
        setBadge() {},
        show() {},
        authorize() {},
        setTheme,
      },
    });
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('dark'));

    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    Reflect.deleteProperty(window, 'spotlightDesktop');
  });

  it('defaults to system', () => {
    const { result } = renderHook(useTheme);

    expect(result.current.theme).toBe('system');
  });

  it('adds the dark class for a stored dark theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderHook(useTheme);

    expect(isDark()).toBe(true);
  });

  it('removes the dark class for light even when the system prefers dark', () => {
    document.documentElement.classList.add('dark');
    media.matches = true;
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderHook(useTheme);

    expect(isDark()).toBe(false);
  });

  it('follows the system preference and its changes', () => {
    media.matches = true;
    renderHook(useTheme);
    expect(isDark()).toBe(true);

    act(() => prefer(false));

    expect(isDark()).toBe(false);
  });

  it('falls back to system for an invalid stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    const { result } = renderHook(useTheme);

    expect(result.current.theme).toBe('system');
  });

  it('stops following the system after switching away from system', () => {
    const { result } = renderHook(useTheme);
    act(() => result.current.setTheme('light'));

    act(() => prefer(true));

    expect(media.listeners.size).toBe(0);
    expect(isDark()).toBe(false);
  });

  it('stores the chosen theme', () => {
    const { result } = renderHook(useTheme);
    act(() => result.current.setTheme('dark'));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});

describe('theme.js', () => {
  const script = () => readFileSync('public/theme.js', 'utf8');

  it('reads the same storage key as the hook', () => {
    expect(script()).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
  });

  it('loads before the app from index.html', () => {
    const html = readFileSync('index.html', 'utf8');

    expect(html.indexOf('<script src="/theme.js"></script>')).toBeGreaterThan(
      -1,
    );
    expect(html.indexOf('/theme.js')).toBeLessThan(
      html.indexOf('/src/main.tsx'),
    );
  });

  describe('script', () => {
    const runScript = () => {
      // oxlint-disable-next-line typescript/no-implied-eval -- runs the theme script as the page would
      (new Function(script()) as () => void)();
    };

    it('does not override a stored light theme on OS change', () => {
      media.matches = false;
      runScript();
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      prefer(true);

      expect(isDark()).toBe(false);
    });

    it('follows OS change while the theme is unset', () => {
      runScript();
      prefer(true);

      expect(isDark()).toBe(true);
    });
  });
});
