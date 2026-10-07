import type { CitedHunk as Hunk } from '@/lib/judge';
import { cn } from '@/lib/utils';

export function CitedHunk({ hunk }: { hunk: Hunk }) {
  return (
    <div
      data-slot="cited-hunk"
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-muted/60"
    >
      <p className="border-border border-b px-3 py-1 font-mono text-muted-foreground text-xs">
        {hunk.path ?? hunk.id} {hunk.header}
      </p>
      {hunk.lines.length > 0 ? (
        <pre className="overflow-x-auto px-3 py-1.5 font-mono text-xs leading-5">
          {hunk.lines.map((line, at) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a hunk's lines are fixed, so where one sits is what names it
              key={at}
              className={cn(
                'block',
                line.startsWith('+') &&
                  'text-emerald-600 dark:text-emerald-400',
                line.startsWith('-') && 'text-destructive',
              )}
            >
              {line}
            </span>
          ))}
        </pre>
      ) : (
        <p className="px-3 py-1.5 text-muted-foreground text-xs">
          Hunk is no longer in the run’s changes.
        </p>
      )}
    </div>
  );
}
