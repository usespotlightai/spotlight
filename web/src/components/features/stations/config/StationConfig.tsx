import { useId } from 'react';
import { AgentInstrument } from '@/components/features/stations/config/AgentInstrument';
import { AlertsInstrument } from '@/components/features/stations/config/AlertsInstrument';
import { JudgeInstrument } from '@/components/features/stations/config/JudgeInstrument';
import { LineInstrument } from '@/components/features/stations/config/LineInstrument';
import { SkillsInstrument } from '@/components/features/stations/config/SkillsInstrument';
import { StationPrompt } from '@/components/features/stations/config/StationPrompt';
import { VersionInstrument } from '@/components/features/stations/config/VersionInstrument';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

type StationConfigProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationConfig({
  slug,
  teamId,
  line,
  station,
}: StationConfigProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1.5">
      <h2 id={titleId} className="font-medium text-foreground text-xs">
        Config
      </h2>

      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AgentInstrument station={station} />
        <StationPrompt stationId={station.id} prompt={station.agentPrompt} />
        <SkillsInstrument skills={station.skills} />
        <JudgeInstrument
          slug={slug}
          teamId={teamId}
          lineId={line.id}
          stationId={station.id}
          judge={station.judge}
        />
        <LineInstrument line={line} />
        {station.alerts.length > 0 && (
          <AlertsInstrument alerts={station.alerts} />
        )}
        <VersionInstrument
          slug={slug}
          teamId={teamId}
          lineId={line.id}
          stationId={station.id}
        />
      </div>
    </section>
  );
}
