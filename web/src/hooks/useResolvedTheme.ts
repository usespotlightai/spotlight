import { useSyncExternalStore } from 'react';

import { appliedTheme } from '@/hooks/useTheme';

export type ResolvedTheme = ReturnType<typeof appliedTheme>;

// useTheme applies the theme as a class on the root element, so a change of that class is a change of the theme.
const subscribe = (changed: () => void) => {
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
};

// The theme that the app shows now: light or dark, never system. It follows the system theme too.
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, appliedTheme, () => 'light');
}
