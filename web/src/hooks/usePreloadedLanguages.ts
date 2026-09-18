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

// Loading every language a stack needs up front spares the first layer that reaches for one.
export function usePreloadedLanguages(paths: readonly string[]): void {
  const langs = languagesOf(paths).sort().join(' ');

  useEffect(() => {
    if (!langs) {
      return;
    }

    // Each diff asks for its own language as it mounts, so a refusal here costs nothing.
    void preloadHighlighter({
      themes: DIFF_THEMES,
      langs: langs.split(' ') as SupportedLanguages[],
    }).catch(() => undefined);
  }, [langs]);
}
