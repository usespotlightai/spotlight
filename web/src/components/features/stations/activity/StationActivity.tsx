import { StationAttention } from '@/components/features/stations/activity/StationAttention';
import { StationRecentRuns } from '@/components/features/stations/activity/StationRecentRuns';
import { StationSummary } from '@/components/features/stations/activity/StationSummary';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

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
  const at = { slug, teamId, lineId: line.id, stationId: station.id };

  return (
    <div className={ACTIVITY_LAYOUT}>
      <StationSummary {...at} />
      <StationAttention line={line} station={station} at={at} />
      <StationRecentRuns {...at} />
    </div>
  );
}
