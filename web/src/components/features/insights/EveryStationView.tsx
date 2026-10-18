import { CandidatesTab } from '@/components/features/insights/candidates/CandidatesTab';
import { ChangesTab } from '@/components/features/insights/changes/ChangesTab';
import { EveryStationSkeleton } from '@/components/features/insights/EveryStationSkeleton';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { StationsTab } from '@/components/features/insights/StationsTab';
import { useInsightsAgentConfigs } from '@/hooks/api/useInsightsAgentConfigs';
import { useInsightsCandidates } from '@/hooks/api/useInsightsCandidates';
import { useInsightsChanges } from '@/hooks/api/useInsightsChanges';
import { useInsightsStations } from '@/hooks/api/useInsightsStations';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import { EVERY_AGENT_CONFIG } from '@/lib/insights-changes';
import { loading } from '@/lib/query';

type EveryStationViewProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

export function EveryStationView(shared: EveryStationViewProps) {
  const { teamId, period, names } = shared;
  const queries = [
    useInsightsStations(teamId, period),
    useInsightsChanges(teamId, period),
    useInsightsAgentConfigs(teamId, period, EVERY_AGENT_CONFIG),
    useInsightsCandidates(teamId, period),
  ];

  if (queries.some(loading)) {
    return <EveryStationSkeleton names={names} />;
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
