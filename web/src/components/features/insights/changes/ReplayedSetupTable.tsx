import { Fragment } from 'react';
import { ReplayedSetupRow } from '@/components/features/insights/changes/ReplayedSetupRow';
import { FoldingRows } from '@/components/shared/nested-table/FoldingRows';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useFolds } from '@/hooks/useFolds';
import {
  REPLAYED_HEADINGS,
  type ReplayedPoint,
  replayedSetsOf,
} from '@/lib/insights-candidates';

type ReplayedSetupTableProps = {
  points: readonly ReplayedPoint[];
  currency: string;
};

export function ReplayedSetupTable({
  points,
  currency,
}: ReplayedSetupTableProps) {
  const folds = useFolds();

  return (
    <div className="mt-4">
      <NestedTable label="Replayed configs" headings={REPLAYED_HEADINGS}>
        {replayedSetsOf(points).map((set) => {
          const open = folds.isOpen(set.name);

          return (
            <Fragment key={set.name}>
              <NestedGroupRow
                label={set.name}
                open={open}
                depth={0}
                onToggle={() => folds.toggle(set.name)}
              >
                <span className="font-medium text-foreground">{set.name}</span>
                <span className="ml-1.5 text-muted-foreground">replayed</span>
              </NestedGroupRow>
              <FoldingRows open={open}>
                {set.points.map((point) => (
                  <ReplayedSetupRow
                    key={point.key}
                    point={point}
                    currency={currency}
                  />
                ))}
              </FoldingRows>
            </Fragment>
          );
        })}
      </NestedTable>
    </div>
  );
}
