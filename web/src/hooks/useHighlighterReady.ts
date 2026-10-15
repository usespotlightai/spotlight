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
  // Read the state immediately so that a warm diff does not paint blank for one frame.
  const [ready, setReady] = useState(() => attached(name));

  // If a diff mounts before Shiki is ready, it paints blank and does not paint again.
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
