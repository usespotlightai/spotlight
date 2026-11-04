import type { ReactNode } from 'react';
import { StationFailures } from '@/components/features/insights/StationFailures';
import { TabSection } from '@/components/features/stations/TabSection';
import { useInsightsStations } from '@/hooks/api/useInsightsStations';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import {
  type FailureReasons,
  failedAny,
  type InsightsPeriod,
  stationReportOf,
} from '@/lib/insights';
import { type ActivityPeriod, LIVE_CONFIG } from '@/lib/station';

const FAILURES_TITLE = 'Why runs failed';

type StationFailureReasonsProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
  period: ActivityPeriod;
};

export function StationFailureReasons({
  period,
  ...at
}: StationFailureReasonsProps) {
  return period === LIVE_CONFIG ? (
    <LiveFailureReasons {...at} />
  ) : (
    <PeriodFailureReasons {...at} period={period} />
  );
}

type ReasonsProps = Omit<StationFailureReasonsProps, 'period'>;

function LiveFailureReasons({ slug, teamId, lineId, stationId }: ReasonsProps) {
  const outcomes = useStationInsights(teamId, lineId, stationId);

  return (
    <FailureReasonsSection
      slug={slug}
      teamId={teamId}
      stationId={stationId}
      reasons={outcomes.data?.inForce}
    />
  );
}

function PeriodFailureReasons({
  slug,
  teamId,
  stationId,
  period,
}: ReasonsProps & { period: InsightsPeriod }) {
  const stations = useInsightsStations(teamId, period);

  return (
    <FailureReasonsSection
      slug={slug}
      teamId={teamId}
      stationId={stationId}
      reasons={stationReportOf(stations.data, stationId)}
    />
  );
}

type FailureReasonsSectionProps = {
  slug: string;
  teamId: string;
  stationId: string;
  reasons: FailureReasons | null | undefined;
};

function FailureReasonsSection({
  slug,
  teamId,
  stationId,
  reasons,
}: FailureReasonsSectionProps): ReactNode {
  if (reasons === undefined) {
    return null;
  }

  return (
    <div className="pt-4">
      <TabSection level={3} title={FAILURES_TITLE}>
        {reasons && failedAny(reasons) ? (
          <StationFailures
            slug={slug}
            teamId={teamId}
            report={{ ...reasons, stationId }}
          />
        ) : (
          <p className="text-muted-foreground text-sm">No runs failed.</p>
        )}
      </TabSection>
    </div>
  );
}
