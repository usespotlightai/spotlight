import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { StationInsightsHeading } from '@/components/features/insights/station/StationInsightsHeading';
import { JudgeAgreementSkeleton } from '@/components/features/stations/judge/JudgeAgreementSkeleton';
import { StationRunOutcomesSkeleton } from '@/components/features/stations/outcomes/StationRunOutcomesSkeleton';
import { StationSection } from '@/components/features/stations/StationSection';
import { RUNS_BY_CONFIG_NOTE, type StationNames } from '@/lib/insights';
import { TALLY_TILES } from '@/lib/insights-tiles';

type StationInsightsSkeletonProps = {
  stationId: string;
  names: StationNames;
  judged: boolean;
};

export function StationInsightsSkeleton({
  stationId,
  names,
  judged,
}: StationInsightsSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading the station"
      className="flex flex-col gap-6"
    >
      <StationInsightsHeading stationId={stationId} names={names} />

      <InsightsTilesSkeleton
        label="Over this period"
        tiles={TALLY_TILES}
        topAligned
      />

      <InsightsCardSkeleton
        title="Runs by config"
        description={RUNS_BY_CONFIG_NOTE}
      >
        <StationRunOutcomesSkeleton />
      </InsightsCardSkeleton>

      {judged && (
        <StationSection title="How far to trust the judge">
          <JudgeAgreementSkeleton />
        </StationSection>
      )}
    </div>
  );
}
