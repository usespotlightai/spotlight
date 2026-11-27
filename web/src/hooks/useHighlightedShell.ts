import { getSharedHighlighter } from '@pierre/diffs';
import { useEffect, useState } from 'react';

import { nonEmpty } from '@/lib/non-empty';

const THEME = { light: 'github-light', dark: 'github-dark' } as const;

export function useHighlightedShell(
  command: string | undefined,
): string | null {
  const [highlighted, setHighlighted] = useState<{
    command: string;
    html: string;
  } | null>(null);

  useEffect(() => {
    if (!nonEmpty(command)) {
      return;
    }

    let alive = true;

    void getSharedHighlighter({
      themes: [THEME.light, THEME.dark],
      langs: ['shellscript'],
    })
      .then((hl) => {
        if (alive) {
          setHighlighted({
            command,
            html: hl.codeToHtml(command, {
              lang: 'shellscript',
              themes: THEME,
              defaultColor: false,
            }),
          });
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [command]);

  return nonEmpty(command) && highlighted?.command === command
    ? highlighted.html
    : null;
}
