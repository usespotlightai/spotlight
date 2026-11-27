import { InsightsCard } from '@/components/features/insights/InsightsCard';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  FLAGGED_HEADINGS,
  FLAGGED_NOTE,
  type FlaggedMemory,
} from '@/lib/insights-memory';
import { formatDay } from '@/lib/judge';
import { memoryPath } from '@/lib/memory';
import { cn } from '@/lib/utils';

type FlaggedMemoriesProps = {
  slug: string;
  teamId: string;
  flagged: readonly FlaggedMemory[];
};

export function FlaggedMemories({
  slug,
  teamId,
  flagged,
}: FlaggedMemoriesProps) {
  return (
    <InsightsCard
      flat
      tableOnly={flagged.length > 0}
      title="Flagged wrong"
      description={FLAGGED_NOTE}
    >
      {flagged.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No memory flagged wrong in this period.
        </p>
      ) : (
        <NestedTable label="Memories flagged wrong" headings={FLAGGED_HEADINGS}>
          {flagged.map((memory) => (
            <li
              key={memory.memoryId}
              data-slot="flagged-memory"
              className={cn(
                'col-span-full grid grid-cols-2 items-baseline gap-x-6 gap-y-2 py-2 pr-2 @4xl:grid-cols-subgrid',
                ROW_DIVIDER,
              )}
            >
              <p
                className={cn(
                  'col-span-full flex min-w-0 items-baseline gap-2 @4xl:col-span-1',
                  EDGE_INDENT,
                )}
              >
                <TrailLink
                  to={memoryPath(slug, teamId, memory.memoryId)}
                  className="shrink-0 text-muted-foreground hover:underline"
                >
                  {memory.handle}
                </TrailLink>
                <span className="min-w-0 text-foreground">{memory.body}</span>
              </p>
              <NestedCell heading="Reason" numeric={false} strong>
                {memory.reason ?? 'No reason given'}
              </NestedCell>
              <NestedCell heading="Flagged by" numeric={false}>
                {memory.byName ?? 'A former member'}
              </NestedCell>
              <NestedCell heading="Date">
                {formatDay(memory.at.slice(0, 10))}
              </NestedCell>
            </li>
          ))}
        </NestedTable>
      )}
    </InsightsCard>
  );
}
