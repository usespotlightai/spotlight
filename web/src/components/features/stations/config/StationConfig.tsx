import { AgentCard } from '@/components/features/stations/config/AgentCard';
import { AlertsCard } from '@/components/features/stations/config/AlertsCard';
import { FingerprintCard } from '@/components/features/stations/config/FingerprintCard';
import { JudgeCard } from '@/components/features/stations/config/JudgeCard';
import { LineCard } from '@/components/features/stations/config/LineCard';
import { SearchPolicyCard } from '@/components/features/stations/config/SearchPolicyCard';
import { SkillsCard } from '@/components/features/stations/config/SkillsCard';
import { StationPrompt } from '@/components/features/stations/config/StationPrompt';
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
  return (
    <section
      aria-label="Config"
      className="grid grid-flow-row-dense auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <AgentCard station={station} />
      <StationPrompt stationId={station.id} prompt={station.agentPrompt} />
      <SkillsCard skills={station.skills} />
      <JudgeCard
        slug={slug}
        teamId={teamId}
        lineId={line.id}
        stationId={station.id}
        judge={station.judge}
      />
      <LineCard line={line} />
      {station.search && <SearchPolicyCard policy={station.search} />}
      {station.alerts.length > 0 && <AlertsCard alerts={station.alerts} />}
      <FingerprintCard
        slug={slug}
        teamId={teamId}
        lineId={line.id}
        stationId={station.id}
      />
    </section>
  );
}
