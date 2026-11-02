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

describe('index.html', () => {
  it('reads the same storage key as the hook', () => {
    const html = readFileSync('index.html', 'utf8');

    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
  });
});
