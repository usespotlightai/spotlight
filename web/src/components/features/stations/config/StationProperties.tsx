import { AgentProperties } from '@/components/features/stations/config/AgentProperties';
import { ImprovementProperties } from '@/components/features/stations/config/ImprovementProperties';
import { LineProperties } from '@/components/features/stations/config/LineProperties';
import { VersionProperties } from '@/components/features/stations/config/VersionProperties';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

type StationPropertiesProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationProperties({
  slug,
  teamId,
  line,
  station,
}: StationPropertiesProps) {
  return (
    <aside
      aria-label="Properties"
      className="flex flex-col gap-8 lg:sticky lg:top-3 lg:self-start"
    >
      <VersionProperties
        slug={slug}
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
