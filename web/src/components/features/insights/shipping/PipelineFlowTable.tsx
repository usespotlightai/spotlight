import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { lastedOrNone } from '@/lib/insights';
import {
  type FlowStage,
  partShown,
  STATION_PARTS,
  worstJam,
} from '@/lib/insights-shipping';

const columnsFor = (
  worst: FlowStage | null,
  stations: boolean,
): InsightsColumn<FlowStage>[] => [
  {
    id: 'stage',
    header: 'Stage',
    cell: (stage) => (
      <span className="flex items-center gap-1.5">
        {stage.label}
        {stage === worst && (
          <span className="text-[0.7rem] text-destructive">Worst jam</span>
        )}
      </span>
    ),
  },
  {
    id: 'time',
    header: 'Time',
    cell: (stage) => lastedOrNone(stage.ms),
    numeric: true,
  },
  ...(stations
    ? STATION_PARTS.map((part) => ({
        id: part,
        header: partShown(part).replace(/^./, (first) => first.toUpperCase()),
        cell: (stage: FlowStage) =>
          stage.parts ? lastedOrNone(stage.parts[part]) : '',
        numeric: true,
      }))
    : []),
];

export function PipelineFlowTable({
  stages,
}: {
  stages: readonly FlowStage[];
}) {
  return (
    <InsightsTable
      label="Flow through the pipeline"
      columns={columnsFor(
        worstJam(stages),
        stages.some((stage) => stage.parts),
      )}
      rows={stages}
      rowKey={(stage) => stage.id}
    />
  );
}
