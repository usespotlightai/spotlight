import { TrailLink } from '@/components/shell/layout/TrailLink';
import { RESULT_INK, type ReplayEntry } from '@/lib/replay';
import { formatReason, formatResult } from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type EntryResultProps = {
  entry: ReplayEntry;
  runTo: string | null;
  reasons?: boolean;
};

export function EntryResult({
  entry,
  runTo,
  reasons: shown = true,
}: EntryResultProps) {
  const reasons = shown ? entry.reasons.map(formatReason) : [];

  return (
    <span data-slot="entry-result" className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1.5">
        <span className={cn('font-medium', RESULT_INK[entry.result])}>
          {formatResult(entry.result)}
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
