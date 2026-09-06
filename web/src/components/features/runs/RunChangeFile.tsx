import { useMemo } from 'react';
import { type FileChange, fileName, tallyFile } from '@/lib/changes';
import { useChangesPanel } from '@/lib/changes-panel';
import { cn } from '@/lib/utils';

export function RunChangeFile({ file }: { file: FileChange }) {
  const { selected, open } = useChangesPanel();
  const { added, removed } = useMemo(() => tallyFile(file), [file]);

  const active = selected === file;

  return (
    <li>
      <button
        type="button"
        onClick={() => open(file)}
        aria-pressed={active}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs leading-6 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70',
          active && 'bg-accent',
        )}
      >
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {fileName(file.path)}
        </span>

        {added > 0 && (
          <span className="shrink-0 text-emerald-600 tabular-nums dark:text-emerald-400">
            +{added}
          </span>
        )}
        {removed > 0 && (
          <span className="shrink-0 text-destructive tabular-nums">
            −{removed}
          </span>
        )}
      </button>
    </li>
  );
}
