import { StationReplays } from '@/components/features/replays/station/StationReplays';
import { StationSearches } from '@/components/features/searches/station/StationSearches';
import { StationOutcomes } from '@/components/features/stations/outcomes/StationOutcomes';
import { StationAlerts } from '@/components/features/stations/StationAlerts';
import { StationJudge } from '@/components/features/stations/StationJudge';
import { StationPrompt } from '@/components/features/stations/StationPrompt';
import { StationSkills } from '@/components/features/stations/StationSkills';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

type WorkStationSectionsProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function WorkStationSections({
  slug,
  teamId,
  line,
  station,
}: WorkStationSectionsProps) {
  const at = { slug, teamId, lineId: line.id, stationId: station.id };

  return (
    <>
      <StationPrompt stationId={station.id} prompt={station.agentPrompt} />

      <StationSkills skills={station.skills} />

      {station.judge && (
        <StationJudge
          slug={slug}
          teamId={teamId}
          lineId={line.id}
          stationId={station.id}
          judge={station.judge}
        />
      )}

      {station.alerts.length > 0 && <StationAlerts alerts={station.alerts} />}

      <StationOutcomes
        slug={slug}
        teamId={teamId}
        lineId={line.id}
        stationId={station.id}
      />

      <StationReplays at={at} lineKey={line.key} stationKey={station.key} />

      <StationSearches
        at={at}
        source={line.source}
        replayCheck={line.replayCheck}
      />
    </>
  );
}
