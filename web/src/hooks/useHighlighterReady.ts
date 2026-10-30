import {
  areLanguagesAttached,
  areThemesAttached,
  getFiletypeFromFileName,
  getSharedHighlighter,
  isHighlighterLoaded,
} from '@pierre/diffs';
import { useEffect, useState } from 'react';
import { DIFF_THEME, DIFF_THEMES } from '@/lib/diff';

const attached = (name: string): boolean =>
  isHighlighterLoaded() &&
  areThemesAttached(DIFF_THEME) &&
  areLanguagesAttached([getFiletypeFromFileName(name)]);

export function useHighlighterReady(name: string): boolean {
  const [loaded, setLoaded] = useState<string | null>(null);

  // If a diff mounts before Shiki is ready, it paints blank and does not paint again.
  useEffect(() => {
    if (attached(name)) {
      return;
    }

    let alive = true;

    void getSharedHighlighter({
      themes: DIFF_THEMES,
      langs: [getFiletypeFromFileName(name)],
    }).then(() => {
      if (alive) {
        setLoaded(name);
      }
    });

    return () => {
      alive = false;
    };
  }, [name]);

  return loaded === name || attached(name);
}
