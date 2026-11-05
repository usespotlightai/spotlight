import { CandidateStationRows } from '@/components/features/insights/candidates/CandidateStationRows';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useCollapsibles } from '@/hooks/useCollapsibles';
import type { StationNames } from '@/lib/insights';
import {
  type CandidatesStation,
  candidateHeadings,
  GainScale,
  gainExtentOf,
} from '@/lib/insights-candidates';

type CandidatesTableProps = {
  stations: readonly CandidatesStation[];
  names: StationNames;
  chartStatus: boolean;
};

export function CandidatesTable({
  stations,
  names,
  chartStatus,
}: CandidatesTableProps) {
  const collapsibles = useCollapsibles();
  const heldOut = stations.some((station) =>
    station.sets.some((set) =>
      set.candidates.some((each) => each.heldOut !== null),
    ),
  );

  const extent = gainExtentOf(stations);

  return (
    <GainScale value={extent}>
      <NestedTable
        label="Replayed candidates"
        headings={candidateHeadings(heldOut, extent)}
        trailing
        compact
        headed={!chartStatus}
      >
        {stations.map((station) => (
          <CandidateStationRows
            key={station.stationId}
            station={station}
            names={names}
            heldOut={heldOut}
            chartStatus={chartStatus}
            collapsibles={collapsibles}
          />
        ))}
      </NestedTable>
    </GainScale>
  );
}
