import { StationConfig } from '@/components/features/stations/config/StationConfig';
import { StationAttention } from '@/components/features/stations/overview/StationAttention';
import { StationRuns } from '@/components/features/stations/overview/StationRuns';
import { StationSummary } from '@/components/features/stations/overview/StationSummary';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

type StationOverviewProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationOverview({
  slug,
  teamId,
  line,
  station,
}: StationOverviewProps) {
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

      <StationAttention line={line} station={station} at={at} />

      <StationRuns {...at} />
    </>
  );
}
