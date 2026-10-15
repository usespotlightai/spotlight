import { useState } from 'react';
import { ChartTableSwitch } from '@/components/features/insights/ChartTableSwitch';
import { CandidatesTable } from '@/components/features/insights/candidates/CandidatesTable';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import type { StationNames } from '@/lib/insights';
import type { CandidatesStation } from '@/lib/insights-candidates';

type CandidatesCardProps = {
  slug: string;
  teamId: string;
  stations: readonly CandidatesStation[];
  names: StationNames;
};

export function CandidatesCard({
  slug,
  teamId,
  stations,
  names,
}: CandidatesCardProps) {
  const [charted, setCharted] = useState(false);
  const shown = { slug, teamId, stations, names };

  return (
    <InsightsCard
      title="Replayed candidates"
      description="Each candidate config replayed on past tasks, compared with the live config on the same runs. The candidate’s own checks and judge decide success. Replays don’t change the station’s config."
      actions={
        <ChartTableSwitch
          tabled={!charted}
          onTabled={(tabled) => setCharted(!tabled)}
        />
      }
    >
      <CandidatesTable {...shown} charted={charted} />
    </InsightsCard>
  );
}
