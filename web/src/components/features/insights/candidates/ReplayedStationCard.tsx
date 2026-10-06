import { ChartScatter, Table2 } from 'lucide-react';
import { useState } from 'react';
import { CandidateComparison } from '@/components/features/insights/candidates/CandidateComparison';
import { ReplayedSetChart } from '@/components/features/insights/candidates/ReplayedSetChart';
import { SetSummary } from '@/components/features/insights/candidates/SetSummary';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { Button } from '@/components/ui/button';
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
};

export function ReplayedStationCard({
  slug,
  teamId,
  station,
  names,
}: ReplayedStationCardProps) {
  const [charted, setCharted] = useState(false);
  const at = candidatesAt(slug, teamId, station);
  const line = names.get(station.stationId)?.lineName;

  return (
    <InsightsCard
      title={stationShown(names, station.stationId)}
      description={`${line ? `${line} · ` : ''}Each candidate config replayed on past tasks, beside the live config on the same runs. Success is by the candidate’s own checks and judge. None of it is applied to the station.`}
      actions={
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-pressed={charted}
          onClick={() => setCharted((was) => !was)}
        >
          {charted ? <Table2 aria-hidden /> : <ChartScatter aria-hidden />}
          {charted ? 'Show table' : 'Show chart'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {station.sets.map((set) => (
          <div key={set.setId} className="flex flex-col gap-4">
            <SetSummary at={at} set={set} />
            {charted ? (
              <ReplayedSetChart set={set} />
            ) : (
              <CandidateComparison at={at} set={set} />
            )}
          </div>
        ))}
      </div>
    </InsightsCard>
  );
}
