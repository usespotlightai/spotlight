import { CandidateSetRows } from '@/components/features/insights/candidates/CandidateSetRows';
import { StationGroupName } from '@/components/features/insights/candidates/StationGroupName';
import { FoldingRows } from '@/components/shared/nested-table/FoldingRows';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import type { Folds } from '@/hooks/useFolds';
import { formatStation, type StationNames } from '@/lib/insights';
import type { CandidatesStation } from '@/lib/insights-candidates';
import type { ReplayedStation } from '@/lib/replay';

type CandidateStationRowsProps = {
  at: ReplayedStation;
  station: CandidatesStation;
  names: StationNames;
  heldOut: boolean;
  charted: boolean;
  folds: Folds;
};

export function CandidateStationRows({
  at,
  station,
  names,
  heldOut,
  charted,
  folds,
}: CandidateStationRowsProps) {
  const open = folds.isOpen(station.stationId);

  return (
    <>
      <NestedGroupRow
        label={formatStation(names, station.stationId)}
        open={open}
        depth={0}
        onToggle={() => folds.toggle(station.stationId)}
      >
        <StationGroupName stationId={station.stationId} names={names} />
      </NestedGroupRow>

      <FoldingRows open={open}>
        {station.sets.map((set) => (
          <CandidateSetRows
            key={set.setId}
            at={at}
            set={set}
            heldOut={heldOut}
            charted={charted}
            open={folds.isOpen(set.setId)}
            onToggle={() => folds.toggle(set.setId)}
          />
        ))}
      </FoldingRows>
    </>
  );
}
