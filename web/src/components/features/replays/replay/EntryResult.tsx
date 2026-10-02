import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { ReplayEntry } from '@/lib/replay';
import { reasonShown, resultShown } from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const INK: Record<ReplayEntry['result'], string> = {
  pending: 'text-muted-foreground',
  succeeded: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-destructive',
  unscored: 'text-muted-foreground',
};

type EntryResultProps = {
  entry: ReplayEntry;
  runTo: string | null;
};

export function EntryResult({ entry, runTo }: EntryResultProps) {
  const reasons = entry.reasons.map(reasonShown);

  return (
    <span data-slot="entry-result" className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1.5">
        <span className={cn('font-medium', INK[entry.result])}>
          {resultShown(entry.result)}
        </span>
        {runTo && (
          <TrailLink
            to={runTo}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Run
          </TrailLink>
        )}
      </span>
      {reasons.length > 0 && (
        <span
          className="block max-w-64 truncate text-muted-foreground"
          title={reasons.join('\n')}
        >
          {reasons[0]}
          {reasons.length > 1 && ` (+${reasons.length - 1})`}
        </span>
      )}
    </span>
  );
}
