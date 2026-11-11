import { useCallback, useEffect, useState } from 'react';

import { desktopApp } from '@/lib/desktop';

export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

export const storedTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
};

const store = (theme: Theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
};

const applyTheme = (theme: Theme) => {
  const dark =
    theme === 'system' ? matchMedia(DARK_QUERY).matches : theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
};

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(storedTheme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') {
      return;
    }
    const query = matchMedia(DARK_QUERY);
    const follow = () => applyTheme('system');
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    store(next);
    desktopApp()?.setTheme?.(next);
  }, []);

  return { theme, setTheme };
}
