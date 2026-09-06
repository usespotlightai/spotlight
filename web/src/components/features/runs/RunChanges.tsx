import { useMemo, useState } from 'react';
import { RunChangeFile } from '@/components/features/runs/RunChangeFile';
import { changesOf, tallyOf } from '@/lib/changes';
import type { RunJournal } from '@/lib/inbox';

const SHOWN = 6;

export function RunChanges({ journals }: { journals: readonly RunJournal[] }) {
  const [all, setAll] = useState(false);

  const files = useMemo(() => changesOf(journals), [journals]);
  const tally = useMemo(() => tallyOf(files), [files]);

  if (files.length === 0) {
    return null;
  }

  const shown = all ? files : files.slice(0, SHOWN);
  const rest = files.length - shown.length;

  return (
    <div className="mt-2 overflow-hidden rounded-lg border-[0.5px] border-border">
      <div className="flex items-center gap-2 border-border border-b-[0.5px] bg-muted/40 px-3 py-2 text-xs">
        <span className="font-medium text-foreground">
          {files.length} {files.length === 1 ? 'file' : 'files'} changed
        </span>
        <span className="ml-auto text-emerald-600 tabular-nums dark:text-emerald-400">
          +{tally.added}
        </span>
        <span className="text-destructive tabular-nums">−{tally.removed}</span>
      </div>

      <ul className="flex flex-col p-1">
        {shown.map((file) => (
          <RunChangeFile key={file.path} file={file} />
        ))}

        {rest > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setAll(true)}
              className="w-full rounded-md px-2 py-1 text-left text-muted-foreground text-xs leading-6 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
            >
              Show {rest} more
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
