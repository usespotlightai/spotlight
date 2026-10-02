import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { spentIn } from '@/lib/inbox';
import { countShown, shareShown } from '@/lib/insights';
import { markShown, type ReplayedPoint } from '@/lib/insights-candidates';

type ReplayedSetupTableProps = {
  points: readonly ReplayedPoint[];
  currency: string;
};

export function ReplayedSetupTable({
  points,
  currency,
}: ReplayedSetupTableProps) {
  const columns: InsightsColumn<ReplayedPoint>[] = [
    {
      id: 'candidate',
      header: 'Replayed',
      cell: (point) => point.label,
    },
    {
      id: 'kind',
      header: 'Kind',
      cell: (point) => markShown(point.mark),
    },
    { id: 'set', header: 'Replay set', cell: (point) => point.setName },
    {
      id: 'scored',
      header: 'Runs scored',
      numeric: true,
      cell: (point) => countShown(point.scored),
    },
    {
      id: 'cost',
      header: 'Cost per run',
      numeric: true,
      cell: (point) => spentIn(point.cost, currency),
    },
    {
      id: 'success',
      header: 'Replay success',
      numeric: true,
      cell: (point) => shareShown(point.value),
    },
    {
      id: 'held-out',
      header: 'Held out',
      numeric: true,
      cell: (point) => point.heldOut ?? '–',
    },
  ];

  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium text-foreground text-xs">Replayed</p>
      <InsightsTable
        label="Replayed candidates"
        columns={columns}
        rows={points}
        rowKey={(point) => point.key}
      />
    </div>
  );
}
