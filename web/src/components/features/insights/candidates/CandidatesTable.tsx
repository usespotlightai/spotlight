import { CandidateStationRows } from '@/components/features/insights/candidates/CandidateStationRows';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useFolds } from '@/hooks/useFolds';
import type { StationNames } from '@/lib/insights';
import {
  type CandidatesStation,
  candidateHeadings,
  candidatesAt,
} from '@/lib/insights-candidates';

type CandidatesTableProps = {
  slug: string;
  teamId: string;
  stations: readonly CandidatesStation[];
  names: StationNames;
  charted: boolean;
};

export function CandidatesTable({
  slug,
  teamId,
  stations,
  names,
  charted,
}: CandidatesTableProps) {
  const folds = useFolds();
  const heldOut = stations.some((station) =>
    station.sets.some((set) =>
      set.candidates.some((each) => each.heldOut !== null),
    ),
  );

  return (
    <NestedTable
      label="Replayed candidates"
      headings={candidateHeadings(heldOut)}
      trailing
      headed={!charted}
    >
      {stations.map((station) => (
        <CandidateStationRows
          key={station.stationId}
          at={candidatesAt(slug, teamId, station)}
          station={station}
          names={names}
          heldOut={heldOut}
          charted={charted}
          folds={folds}
        />
      ))}
    </NestedTable>
  );
}
