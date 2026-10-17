import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { formatCount } from '@/lib/insights';
import {
  REFUSAL_HEADINGS,
  refusedToolFilter,
  type ToolRefusals,
} from '@/lib/insights-tools';
import { cn } from '@/lib/utils';

export function RefusedTools({
  refusals,
}: {
  refusals: readonly ToolRefusals[];
}) {
  return (
    <InsightsCard
      tableOnly
      title="Refused approvals"
      description="Runs where a person refused a tool approval, per server and tool."
    >
      <NestedTable
        label="Refused approvals per tool"
        headings={REFUSAL_HEADINGS}
      >
        {refusals.map((refused) => (
          <li
            key={`${refused.server ?? ''}/${refused.tool}`}
            data-slot="refused-tool"
            className={cn(
              'col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 @4xl:grid-cols-subgrid',
              ROW_DIVIDER,
            )}
          >
            <span
              className={cn(
                'col-span-full min-w-0 truncate font-medium text-foreground text-xs @4xl:col-span-1',
                EDGE_INDENT,
              )}
            >
              {refused.tool}
            </span>
            <NestedCell heading="Server" numeric={false}>
              {refused.server ?? '–'}
            </NestedCell>
            <NestedCell heading="Refused" strong>
              <InsightsLink tab="runs" filter={refusedToolFilter(refused)}>
                {formatCount(refused.refused)}
              </InsightsLink>
            </NestedCell>
          </li>
        ))}
      </NestedTable>
    </InsightsCard>
  );
}
