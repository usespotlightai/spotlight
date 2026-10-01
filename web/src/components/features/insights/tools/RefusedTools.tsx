import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { countShown } from '@/lib/insights';
import { refusedToolFilter, type ToolRefusals } from '@/lib/insights-tools';

export function RefusedTools({
  refusals,
}: {
  refusals: readonly ToolRefusals[];
}) {
  const columns: InsightsColumn<ToolRefusals>[] = [
    {
      id: 'tool',
      header: 'Tool',
      cell: (refused) => <span className="font-mono">{refused.tool}</span>,
    },
    {
      id: 'server',
      header: 'Server',
      cell: (refused) => refused.server ?? '–',
    },
    {
      id: 'refused',
      header: 'Refused',
      numeric: true,
      cell: (refused) => (
        <InsightsLink tab="runs" filter={refusedToolFilter(refused)}>
          {countShown(refused.refused)}
        </InsightsLink>
      ),
    },
  ];

  return (
    <InsightsCard
      title="Refused approvals"
      description="Runs in which a person refused to approve a tool, per tool of each server."
    >
      <InsightsTable
        label="Refused approvals per tool"
        columns={columns}
        rows={refusals}
        rowKey={(refused) => `${refused.server ?? ''}/${refused.tool}`}
      />
    </InsightsCard>
  );
}
