import { getFiletypeFromFileName, getSharedHighlighter } from '@pierre/diffs';
import { useEffect, useState } from 'react';
import { DIFF_THEME } from '@/lib/diff';

export function useHighlighterReady(name: string): boolean {
  const [ready, setReady] = useState(false);

  // A diff mounted before Shiki is ready paints blank and never repaints.
  useEffect(() => {
    let alive = true;
    setReady(false);

    void getSharedHighlighter({
      themes: [DIFF_THEME.light, DIFF_THEME.dark],
      langs: [getFiletypeFromFileName(name)],
    }).then(() => {
      if (alive) {
        setReady(true);
      }
    });

    return () => {
      alive = false;
    };
  }, [name]);

  return ready;
}
