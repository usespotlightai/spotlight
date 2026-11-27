import { ReplayedAgentConfigRow } from '@/components/features/insights/changes/ReplayedAgentConfigRow';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  REPLAYED_HEADINGS,
  type ReplayedPoint,
} from '@/lib/insights-candidates';

type ReplayedAgentConfigTableProps = {
  points: readonly ReplayedPoint[];
  currency: string;
};

export function ReplayedAgentConfigTable({
  points,
  currency,
}: ReplayedAgentConfigTableProps) {
  return (
    <div className="mt-4">
      <NestedTable label="Replayed configs" headings={REPLAYED_HEADINGS}>
        {points.map((point) => (
          <ReplayedAgentConfigRow
            key={point.key}
            point={point}
            currency={currency}
          />
        ))}
      </NestedTable>
    </div>
  );
}
