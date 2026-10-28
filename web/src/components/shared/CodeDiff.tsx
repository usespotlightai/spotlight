import { parseDiffFromFile } from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHighlighterReady } from '@/hooks/useHighlighterReady';
import type { LineRange } from '@/lib/changes';
import { diffOptions } from '@/lib/diff';
import { cn } from '@/lib/utils';

const MAX_TRIES = 60;

export function CodeDiff({
  path,
  before,
  after,
  flush = false,
  lines = null,
}: {
  path: string | null;
  before: string;
  after: string;
  flush?: boolean;
  lines?: LineRange | null;
}) {
  const name = path ?? 'file';
  const ready = useHighlighterReady(name);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready || !lines) {
      return;
    }

    let tries = 0;
    let waiting = 0;

    const find = () => {
      const shown = [...(container.current?.querySelectorAll('*') ?? [])]
        .find((each) => each.shadowRoot)
        ?.shadowRoot?.querySelector('[data-selected-line]');

      if (shown) {
        shown.scrollIntoView({ block: 'center' });
      } else if (tries < MAX_TRIES) {
        tries += 1;
        waiting = requestAnimationFrame(find);
      }
    };

    waiting = requestAnimationFrame(find);

    return () => cancelAnimationFrame(waiting);
  }, [ready, lines]);

  const fileDiff = useMemo(
    () =>
      parseDiffFromFile({ name, contents: before }, { name, contents: after }),
    [name, before, after],
  );

  return (
    <ScrollArea
      ref={container}
      data-slot="code-diff"
      orientation="horizontal"
      className={cn(!flush && 'rounded-md border-[0.5px] border-border')}
      contentClassName="text-xs"
    >
      {ready && (
        <FileDiff
          fileDiff={fileDiff}
          options={diffOptions(flush)}
          selectedLines={lines ? { ...lines, side: 'additions' } : null}
        />
      )}
    </ScrollArea>
  );
}
