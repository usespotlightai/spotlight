import {
  getFiletypeFromFileName,
  preloadHighlighter,
  type SupportedLanguages,
} from '@pierre/diffs';
import { useEffect } from 'react';
import { DIFF_THEMES } from '@/lib/diff';

const languagesOf = (paths: readonly string[]): SupportedLanguages[] => [
  ...new Set(paths.map((path) => getFiletypeFromFileName(path))),
];

// Load all the languages of a stack at the start, so that a layer does not wait for its language.
export function usePreloadedLanguages(paths: readonly string[]): void {
  const langs = languagesOf(paths).sort().join(' ');

  useEffect(() => {
    if (!langs) {
      return;
    }

    // A failure here has no effect, because each diff asks for its language when it mounts.
    void preloadHighlighter({
      themes: DIFF_THEMES,
      langs: langs.split(' ') as SupportedLanguages[],
    }).catch(() => undefined);
  }, [langs]);
}
