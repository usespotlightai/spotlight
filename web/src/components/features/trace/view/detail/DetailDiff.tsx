import { parseDiffFromFile } from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import { useMemo } from 'react';

export function DetailDiff({
  path,
  before,
  after,
}: {
  path: string | null;
  before: string;
  after: string;
}) {
  const name = path ?? 'file';

  const fileDiff = useMemo(
    () =>
      parseDiffFromFile({ name, contents: before }, { name, contents: after }),
    [name, before, after],
  );

  return (
    <div className="overflow-x-auto rounded-md border-[0.5px] border-border text-xs">
      <FileDiff
        fileDiff={fileDiff}
        options={{
          diffStyle: 'unified',
          disableFileHeader: true,
          overflow: 'wrap',
          // The panel is narrow and the diff sets its own size inside a shadow
          // root, where nothing outside it can reach.
          unsafeCSS: ':host { font-size: 11px; line-height: 1.5; }',
        }}
      />
    </div>
  );
}
