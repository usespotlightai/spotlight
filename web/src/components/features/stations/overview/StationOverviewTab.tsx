import { StationConfig } from '@/components/features/stations/config/StationConfig';
import { StationRuns } from '@/components/features/stations/overview/StationRuns';
import { StationSummary } from '@/components/features/stations/overview/StationSummary';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

type StationOverviewTabProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationOverviewTab({
  slug,
  teamId,
  line,
  station,
}: StationOverviewTabProps) {
  const at = { slug, teamId, lineId: line.id, stationId: station.id };

  return (
    <>
      <StationSummary {...at} />

      <StationConfig
        slug={slug}
        teamId={teamId}
        line={line}
        station={station}
      />

      <StationRuns {...at} />
    </>
  );
}
