import { CandidateSetRows } from '@/components/features/insights/candidates/CandidateSetRows';
import { SetSummary } from '@/components/features/insights/candidates/SetSummary';
import { StationGroupName } from '@/components/features/insights/candidates/StationGroupName';
import { CollapsibleRows } from '@/components/shared/nested-table/CollapsibleRows';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import type { Collapsibles } from '@/hooks/useCollapsibles';
import { formatStation, type StationNames } from '@/lib/insights';
import type { CandidatesStation } from '@/lib/insights-candidates';
import type { ReplayedStation } from '@/lib/replay';

type CandidateStationRowsProps = {
  at: ReplayedStation;
  station: CandidatesStation;
  names: StationNames;
  heldOut: boolean;
  chartStatus: boolean;
  collapsibles: Collapsibles;
};

export function CandidateStationRows({
  at,
  station,
  names,
  heldOut,
  chartStatus,
  collapsibles,
}: CandidateStationRowsProps) {
  const open = collapsibles.isOpen(station.stationId);

  return (
    <>
      <NestedGroupRow
        label={formatStation(names, station.stationId)}
        open={open}
        depth={0}
        onToggle={() => collapsibles.toggle(station.stationId)}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <StationGroupName stationId={station.stationId} names={names} />
          {station.sets.map((set) => (
            <SetSummary key={set.setId} at={at} set={set} />
          ))}
        </div>
      </NestedGroupRow>

      <CollapsibleRows open={open}>
        {station.sets.map((set) => (
          <CandidateSetRows
            key={set.setId}
            at={at}
            set={set}
            heldOut={heldOut}
            chartStatus={chartStatus}
          />
        ))}
      </CollapsibleRows>
    </>
  );
}
