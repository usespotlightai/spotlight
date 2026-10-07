import { StationAgentSettings } from '@/components/features/stations/config/StationAgentSettings';
import { StationJudgeSettings } from '@/components/features/stations/config/StationJudgeSettings';
import { StationLineSettings } from '@/components/features/stations/config/StationLineSettings';
import { StationPrompt } from '@/components/features/stations/config/StationPrompt';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { stationTabPath } from '@/lib/station';

type StationConfigTabProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationConfigTab({
  slug,
  teamId,
  line,
  station,
}: StationConfigTabProps) {
  return (
    <>
      <p className="text-muted-foreground text-sm leading-6">
        Set in Terraform. Try a change first in{' '}
        <TrailLink
          to={stationTabPath(slug, teamId, line.id, station.id, 'improve')}
          className="text-foreground underline-offset-2 hover:underline"
        >
          Improve
        </TrailLink>
        .
      </p>

      <StationAgentSettings station={station} />

      <StationPrompt stationId={station.id} prompt={station.agentPrompt} />

      <StationJudgeSettings stationId={station.id} judge={station.judge} />

      <StationLineSettings slug={slug} teamId={teamId} line={line} />
    </>
  );
}
