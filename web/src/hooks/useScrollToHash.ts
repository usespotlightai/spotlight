import { useEffect } from 'react';
import { useLocation } from 'react-router';

const anchorOf = (hash: string): string | null => {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
};

export function useScrollToHash(shown: boolean): void {
  const { hash } = useLocation();

  useEffect(() => {
    const anchor = hash ? anchorOf(hash) : null;

    if (shown && anchor !== null && anchor !== '') {
      document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
    }
  }, [shown, hash]);
}
