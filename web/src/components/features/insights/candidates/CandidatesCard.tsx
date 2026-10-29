import { useState } from 'react';
import { ChartTableSwitch } from '@/components/features/insights/ChartTableSwitch';
import { CandidatesTable } from '@/components/features/insights/candidates/CandidatesTable';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import type { StationNames } from '@/lib/insights';
import type { CandidatesStation } from '@/lib/insights-candidates';
import { CANDIDATES_NOTE } from '@/lib/insights-candidates';

type CandidatesCardProps = {
  stations: readonly CandidatesStation[];
  names: StationNames;
};

export function CandidatesCard({ stations, names }: CandidatesCardProps) {
  const [chartStatus, setCharted] = useState(false);
  const shown = { stations, names };

  return (
    <InsightsCard
      scrolls
      title="Replayed candidates"
      description={CANDIDATES_NOTE}
      actions={
        <ChartTableSwitch
          tabled={!chartStatus}
          onTabled={(tabled) => setCharted(!tabled)}
        />
      }
    >
      <CandidatesTable {...shown} chartStatus={chartStatus} />
    </InsightsCard>
  );
}
