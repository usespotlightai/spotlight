import { CandidatesSkeleton } from '@/components/features/insights/candidates/CandidatesSkeleton';
import { ChangesSkeleton } from '@/components/features/insights/changes/ChangesSkeleton';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { OVERVIEW_LAYOUT } from '@/components/features/insights/overview-layout';
import { StationsSkeleton } from '@/components/features/insights/StationsSkeleton';
import { type StationNames, workStationCount } from '@/lib/insights';

export function EveryStationSkeleton({ names }: { names: StationNames }) {
  return (
    <div className={OVERVIEW_LAYOUT}>
      <InsightsSection title="Runs">
        <StationsSkeleton stations={workStationCount(names)} />
      </InsightsSection>

      <InsightsSection title="Config changes">
        <ChangesSkeleton names={names} />
      </InsightsSection>

      <InsightsSection title="Candidates">
        <CandidatesSkeleton />
      </InsightsSection>
    </div>
  );
}
