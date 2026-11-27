import { parseDiffFromFile } from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import { useMemo, useRef, type ReactElement } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useHighlighterReady } from '@/hooks/useHighlighterReady';
import { useScrollToSelectedLine } from '@/hooks/useScrollToSelectedLine';
import type { LineRange } from '@/lib/changes';
import { diffOptions } from '@/lib/diff';
import { cn } from '@/lib/utils';

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
}): ReactElement {
  const name = path ?? 'file';
  const ready = useHighlighterReady(name);
  const container = useRef<HTMLDivElement>(null);

  useScrollToSelectedLine(container, lines, ready);

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
