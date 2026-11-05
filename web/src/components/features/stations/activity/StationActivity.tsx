import { useSearchParams } from 'react-router';
import { StationAttention } from '@/components/features/stations/activity/StationAttention';
import { StationRecentRuns } from '@/components/features/stations/activity/StationRecentRuns';
import { StationSummary } from '@/components/features/stations/activity/StationSummary';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { activityPeriodOf } from '@/lib/station';

export const ACTIVITY_LAYOUT = 'flex flex-col gap-10 pt-3';

type StationActivityProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationActivity({
  slug,
  teamId,
  line,
  station,
}: StationActivityProps) {
  const [params] = useSearchParams();
  const period = activityPeriodOf(params);
  const at = { slug, teamId, lineId: line.id, stationId: station.id };

  return (
    <div className={ACTIVITY_LAYOUT}>
      <StationSummary {...at} period={period} />
      <StationAttention line={line} station={station} at={at} period={period} />
      <StationRecentRuns {...at} period={period} />
    </div>
  );
}
