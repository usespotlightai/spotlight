import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { formatDurationOrNone, formatSpend } from '@/lib/insights';
import {
  type EntryComparison,
  formatCostDelta,
  formatMsDelta,
  meanCostOf,
  meanMsOf,
} from '@/lib/replay';

type TaskSpendCellsProps = {
  row: EntryComparison;
  compared: boolean;
  currency: string;
};

export function TaskSpendCells({
  row,
  compared,
  currency,
}: TaskSpendCellsProps) {
  if (!compared) {
    return (
      <>
        <NestedCell heading="Cost">
          {formatSpend(meanCostOf(row.candidate))}
        </NestedCell>
        <NestedCell heading="Time">
          {formatDurationOrNone(meanMsOf(row.candidate))}
        </NestedCell>
      </>
    );
  }

  return (
    <>
      <NestedCell heading="Cost change">
        {formatCostDelta(row.costDelta, currency)}
      </NestedCell>
      <NestedCell heading="Time change">
        {formatMsDelta(row.msDelta)}
      </NestedCell>
    </>
  );
}
