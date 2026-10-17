import { CandidatesSkeleton } from '@/components/features/insights/candidates/CandidatesSkeleton';
import { ChangesSkeleton } from '@/components/features/insights/changes/ChangesSkeleton';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { StationsSkeleton } from '@/components/features/insights/StationsSkeleton';
import { type StationNames, workStationCount } from '@/lib/insights';

export function EveryStationSkeleton({ names }: { names: StationNames }) {
  return (
    <div className="flex flex-col gap-3">
      <InsightsSection title="Runs at each station">
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
