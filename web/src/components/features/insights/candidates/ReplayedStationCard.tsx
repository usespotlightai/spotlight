import { ReplayedSetChart } from '@/components/features/insights/candidates/ReplayedSetChart';
import { ReplayedTable } from '@/components/features/insights/candidates/ReplayedTable';
import { ReplaySetHealth } from '@/components/features/insights/candidates/ReplaySetHealth';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { type StationNames, stationShown } from '@/lib/insights';
import {
  type CandidatesStation,
  candidatesAt,
} from '@/lib/insights-candidates';

type ReplayedStationCardProps = {
  slug: string;
  teamId: string;
  station: CandidatesStation;
  names: StationNames;
  now: Date;
};

export function ReplayedStationCard({
  slug,
  teamId,
  station,
  names,
  now,
}: ReplayedStationCardProps) {
  const at = candidatesAt(slug, teamId, station);
  const line = names.get(station.stationId)?.lineName;

  return (
    <InsightsCard
      title={stationShown(names, station.stationId)}
      description={`${line ? `${line} · ` : ''}Replay success on past tasks against cost per run, scored by each candidate’s own checks and judge. Nothing here was applied to the station.`}
      table={
        <div className="flex flex-col gap-4">
          {station.sets.map((set) => (
            <div key={set.setId} className="flex flex-col gap-1">
              <ReplaySetHealth at={at} set={set} now={now} />
              <ReplayedTable at={at} set={set} />
            </div>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {station.sets.map((set) => (
          <div key={set.setId} className="flex flex-col gap-2">
            <ReplaySetHealth at={at} set={set} now={now} />
            <ReplayedSetChart set={set} />
          </div>
        ))}
      </div>
    </InsightsCard>
  );
}
