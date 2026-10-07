import { StationAlerts } from '@/components/features/stations/overview/StationAlerts';
import { StationGlance } from '@/components/features/stations/overview/StationGlance';
import { StationJudgeLine } from '@/components/features/stations/overview/StationJudgeLine';
import { StationRecentRuns } from '@/components/features/stations/overview/StationRecentRuns';
import type { StationResponseDto } from '@/lib/api';

type StationOverviewTabProps = {
  slug: string;
  teamId: string;
  lineId: string;
  station: StationResponseDto;
};

export function StationOverviewTab({
  slug,
  teamId,
  lineId,
  station,
}: StationOverviewTabProps) {
  const at = { slug, teamId, lineId, stationId: station.id };

  return (
    <>
      <StationGlance {...at} />

      {station.alerts.length > 0 && <StationAlerts alerts={station.alerts} />}

      {station.judge && <StationJudgeLine {...at} />}

      <StationRecentRuns {...at} />
    </>
  );
}
