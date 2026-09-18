import { parseDiffFromFile } from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import { useMemo } from 'react';
import { useHighlighterReady } from '@/hooks/useHighlighterReady';
import { diffOptions } from '@/lib/diff';
import { cn } from '@/lib/utils';

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
  const ready = useHighlighterReady(name);

  const fileDiff = useMemo(
    () =>
      parseDiffFromFile({ name, contents: before }, { name, contents: after }),
    [name, before, after],
  );

  return (
    <div
      className={cn(
        'overflow-x-auto text-xs',
        !flush && 'rounded-md border-[0.5px] border-border',
      )}
    >
      {ready && <FileDiff fileDiff={fileDiff} options={diffOptions(flush)} />}
    </div>
  );
}
