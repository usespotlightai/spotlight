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
  DISMISSAL_HEADINGS,
  dismissedToolFilter,
  type ToolDismissals,
} from '@/lib/insights-tools';
import { cn } from '@/lib/utils';

export function DismissedTools({
  dismissals,
}: {
  dismissals: readonly ToolDismissals[];
}) {
  return (
    <InsightsCard
      tableOnly
      title="Dismissed approvals"
      description="Runs where a person dismissed a tool approval, per server and tool."
    >
      <NestedTable
        label="Dismissed approvals per tool"
        headings={DISMISSAL_HEADINGS}
      >
        {dismissals.map((dismissed) => (
          <li
            key={`${dismissed.server ?? ''}/${dismissed.tool}`}
            data-slot="dismissed-tool"
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
              {dismissed.tool}
            </span>
            <NestedCell heading="Server" numeric={false}>
              {dismissed.server ?? '–'}
            </NestedCell>
            <NestedCell heading="Dismissed" strong>
              <InsightsLink tab="runs" filter={dismissedToolFilter(dismissed)}>
                {formatCount(dismissed.dismissed)}
              </InsightsLink>
            </NestedCell>
          </li>
        ))}
      </NestedTable>
    </InsightsCard>
  );
}
