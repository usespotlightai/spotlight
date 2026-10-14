import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { lastedOrNone, spendShown } from '@/lib/insights';
import {
  costDeltaShown,
  type EntryComparison,
  meanCostOf,
  meanMsOf,
  msDeltaShown,
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
          {spendShown(meanCostOf(row.candidate))}
        </NestedCell>
        <NestedCell heading="Time">
          {lastedOrNone(meanMsOf(row.candidate))}
        </NestedCell>
      </>
    );
  }

  return (
    <>
      <NestedCell heading="Cost change">
        {costDeltaShown(row.costDelta, currency)}
      </NestedCell>
      <NestedCell heading="Time change">{msDeltaShown(row.msDelta)}</NestedCell>
    </>
  );
}
