import { CandidatesSkeleton } from '@/components/features/insights/candidates/CandidatesSkeleton';
import { NoCandidates } from '@/components/features/insights/candidates/NoCandidates';
import { ReplayedStationCard } from '@/components/features/insights/candidates/ReplayedStationCard';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { TruncatedNote } from '@/components/features/insights/TruncatedNote';
import { useInsightsCandidates } from '@/hooks/api/useInsightsCandidates';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import { CANDIDATES_TRUNCATED } from '@/lib/insights-candidates';
import { failed, loading } from '@/lib/query';

type CandidatesTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

export function CandidatesTab({
  slug,
  teamId,
  period,
  names,
}: CandidatesTabProps) {
  const candidates = useInsightsCandidates(teamId, period);

  if (loading(candidates)) {
    return <CandidatesSkeleton />;
  }

  if (failed(candidates) || !candidates.data) {
    return <InsightsFailed what="The candidates" query={candidates} />;
  }

  const read = candidates.data;

  if (read.stations.length === 0) {
    return (
      <NoCandidates
        slug={slug}
        teamId={teamId}
        lineId={[...names.values()][0]?.lineId ?? null}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {read.truncated && <TruncatedNote said={CANDIDATES_TRUNCATED} />}

      {read.stations.map((station) => (
        <ReplayedStationCard
          key={station.stationId}
          slug={slug}
          teamId={teamId}
          station={station}
          names={names}
        />
      ))}
    </div>
  );
}
