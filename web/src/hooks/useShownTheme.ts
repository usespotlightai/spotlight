import { useSyncExternalStore } from 'react';

export type ShownTheme = 'light' | 'dark';

// useTheme applies the theme as the dark class on the root element. This reads that class, so it also follows the system theme.
const shown = (): ShownTheme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const subscribe = (changed: () => void) => {
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
};

// The theme that the app shows now: light or dark, never system.
export function useShownTheme(): ShownTheme {
  return useSyncExternalStore(subscribe, shown, () => 'light');
}
