import { AgentProperties } from '@/components/features/stations/config/AgentProperties';
import { ImprovementProperties } from '@/components/features/stations/config/ImprovementProperties';
import { LineProperties } from '@/components/features/stations/config/LineProperties';
import { VersionProperties } from '@/components/features/stations/config/VersionProperties';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

type StationPropertiesProps = {
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationProperties({
  teamId,
  line,
  station,
}: StationPropertiesProps) {
  return (
    <aside
      aria-label="Properties"
      className="grid content-start gap-10 max-lg:order-first sm:max-lg:grid-cols-2 lg:sticky lg:top-3 lg:self-start"
    >
      <VersionProperties
        teamId={teamId}
        lineId={line.id}
        stationId={station.id}
      />
      <AgentProperties station={station} />
      <LineProperties line={line} skills={station.skills} />
      {station.search && <ImprovementProperties policy={station.search} />}
    </aside>
  );
}
