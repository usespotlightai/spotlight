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
  /** Drops the bordered box so the caller's own padding frames the code. */
  flush?: boolean;
}) {
  const name = path ?? 'file';
  const [ready, setReady] = useState(false);

  const fileDiff = useMemo(
    () =>
      parseDiffFromFile({ name, contents: before }, { name, contents: after }),
    [name, before, after],
  );

  // A FileDiff mounted before Shiki has the theme and language paints a blank
  // pre and never repaints itself, so hold it back until the highlighter is
  // ready, then mount it with everything in hand.
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
            // The panel is narrow and the diff sets its own size inside a shadow
            // root, where nothing outside it can reach. Flush drops the file's
            // top and bottom padding and clears the base background, which
            // otherwise show as a dark band above the first line and below the
            // last; the panel behind shows through instead, and the per-line
            // add/delete tints keep their own colours.
            // color-scheme: inherit so the diff follows the app's `.dark` class
            // rather than the library's own `light dark`, which tracks the OS.
            // Flush drops the file padding and base background that would
            // otherwise show as dark bands above and below the code.
            unsafeCSS: `:host { color-scheme: inherit; font-size: 11px; line-height: 1.5;${
              flush ? ' --diffs-gap-block: 0; --diffs-bg: transparent;' : ''
            } }`,
          }}
        />
      )}
    </div>
  );
}
