import { CandidatesTab } from '@/components/features/insights/candidates/CandidatesTab';
import { ChangesTab } from '@/components/features/insights/changes/ChangesTab';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { StationsTab } from '@/components/features/insights/StationsTab';
import type { InsightsPeriod, StationNames } from '@/lib/insights';

type StationsViewProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
  stationId: string | undefined;
};

export function StationsView({ stationId, ...shared }: StationsViewProps) {
  if (stationId) {
    return <StationsTab {...shared} stationId={stationId} />;
  }

  return (
    <>
      <InsightsSection title="Runs at each station">
        <StationsTab {...shared} />
      </InsightsSection>

      <InsightsSection title="Config changes">
        <ChangesTab {...shared} />
      </InsightsSection>

      <InsightsSection title="Candidates">
        <CandidatesTab {...shared} />
      </InsightsSection>
    </>
  );
}
