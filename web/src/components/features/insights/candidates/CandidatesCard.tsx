import { useState } from 'react';
import { ChartTableSwitch } from '@/components/features/insights/ChartTableSwitch';
import { CandidatesTable } from '@/components/features/insights/candidates/CandidatesTable';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import type { StationNames } from '@/lib/insights';
import type { CandidatesStation } from '@/lib/insights-candidates';
import { CANDIDATES_NOTE } from '@/lib/insights-candidates';

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
      scrolls
      title="Replayed candidates"
      description={CANDIDATES_NOTE}
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
