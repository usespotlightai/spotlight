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
  // Reading it at once keeps a warm diff from painting blank for a frame.
  const [ready, setReady] = useState(() => attached(name));

  // A diff mounted before Shiki is ready paints blank and never repaints.
  useEffect(() => {
    if (attached(name)) {
      setReady(true);
      return;
    }

    let alive = true;
    setReady(false);

    void getSharedHighlighter({
      themes: DIFF_THEMES,
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
