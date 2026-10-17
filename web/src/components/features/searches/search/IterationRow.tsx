import { IterationFacts } from '@/components/features/searches/search/IterationFacts';
import { Noted } from '@/components/shared/Noted';
import type { SearchIterationResponseDto } from '@/lib/api';
import { formatSpend } from '@/lib/insights';
import type { ReplayedStation } from '@/lib/replay';
import { formatIterationNote } from '@/lib/search-words';

type IterationRowProps = {
  at: ReplayedStation;
  title: string;
  iteration: SearchIterationResponseDto | null;
};

export function IterationRow({ at, title, iteration }: IterationRowProps) {
  const label = <span className="text-foreground">{title}</span>;

  return (
    <li
      data-slot="iteration"
      data-kind={iteration?.kind}
      className="col-span-full flex min-h-7 flex-wrap items-center gap-x-1.5 border-border border-t bg-surface py-1 pr-2 pl-2 text-xs first:border-t-0"
    >
      {iteration ? (
        <Noted
          note={formatIterationNote(
            iteration,
            (iteration.agentSpent?.spends ?? []).map(formatSpend),
          )}
        >
          {label}
        </Noted>
      ) : (
        label
      )}
      {iteration && <IterationFacts at={at} iteration={iteration} />}
    </li>
  );
}
