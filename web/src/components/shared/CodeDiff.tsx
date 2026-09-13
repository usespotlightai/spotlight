import {
  getFiletypeFromFileName,
  getSharedHighlighter,
  parseDiffFromFile,
} from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

const THEME = { light: 'github-light', dark: 'github-dark' } as const;

export function CodeDiff({
  path,
  before,
  after,
  flush = false,
}: {
  path: string | null;
  before: string;
  after: string;
  flush?: boolean;
}) {
  const name = path ?? 'file';
  const [ready, setReady] = useState(false);

  const fileDiff = useMemo(
    () =>
      parseDiffFromFile({ name, contents: before }, { name, contents: after }),
    [name, before, after],
  );

  // A FileDiff mounted before Shiki is ready paints blank and never repaints.
  useEffect(() => {
    let alive = true;
    setReady(false);

    void getSharedHighlighter({
      themes: [THEME.light, THEME.dark],
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

  return (
    <div
      className={cn(
        'overflow-x-auto text-xs',
        !flush && 'rounded-md border-[0.5px] border-border',
      )}
    >
      {ready && (
        <FileDiff
          fileDiff={fileDiff}
          options={{
            diffStyle: 'unified',
            disableFileHeader: true,
            overflow: 'wrap',
            theme: THEME,
            // Shadow-root CSS: inherit color-scheme to follow the app's .dark class, not the OS.
            unsafeCSS: `:host { color-scheme: inherit; font-size: 11px; line-height: 1.5;${
              flush ? ' --diffs-gap-block: 0; --diffs-bg: transparent;' : ''
            } }`,
          }}
        />
      )}
    </div>
  );
}
