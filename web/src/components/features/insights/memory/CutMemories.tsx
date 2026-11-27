import type { ReactElement } from 'react';

import { InsightsCard } from '@/components/features/insights/InsightsCard';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { formatCount } from '@/lib/insights';
import {
  CUT_HEADINGS,
  type CutMemory,
  cutNote,
  type InsightsMemory,
} from '@/lib/insights-memory';
import { memoryPath } from '@/lib/memory';
import { cn } from '@/lib/utils';

type CutMemoriesProps = {
  slug: string;
  teamId: string;
  memory: InsightsMemory;
};

export function CutMemories({
  slug,
  teamId,
  memory,
}: CutMemoriesProps): ReactElement {
  const cut: readonly CutMemory[] = memory.cutThenRead;

  return (
    <InsightsCard
      flat
      tableOnly={cut.length > 0}
      title="Cut, then read"
      description={cutNote(memory)}
    >
      {cut.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No run read a memory that the cap cut from its brief in this period.
        </p>
      ) : (
        <NestedTable label="Memories cut, then read" headings={CUT_HEADINGS}>
          {cut.map((each) => (
            <li
              key={each.memoryId}
              data-slot="cut-memory"
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
                  to={memoryPath(slug, teamId, each.memoryId)}
                  className="shrink-0 text-muted-foreground hover:underline"
                >
                  {each.handle}
                </TrailLink>
                <span className="min-w-0 text-foreground">{each.body}</span>
              </p>
              <NestedCell heading="Runs">{formatCount(each.runs)}</NestedCell>
            </li>
          ))}
        </NestedTable>
      )}
    </InsightsCard>
  );
}
