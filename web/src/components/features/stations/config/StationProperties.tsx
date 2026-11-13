import { AgentProperties } from '@/components/features/stations/config/AgentProperties';
import { ImprovementProperties } from '@/components/features/stations/config/ImprovementProperties';
import { LineProperties } from '@/components/features/stations/config/LineProperties';
import { VersionProperties } from '@/components/features/stations/config/VersionProperties';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { cn } from '@/lib/utils';

export const PROPERTIES_LAYOUT =
  'grid content-start gap-10 order-first @xl/pane:grid-cols-2 @4xl/pane:order-none @4xl/pane:grid-cols-1';

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
      className={cn(
        PROPERTIES_LAYOUT,
        '@4xl/pane:sticky @4xl/pane:top-12 @4xl/pane:max-h-[calc(100svh-11rem)] @4xl/pane:self-start @4xl/pane:overflow-y-auto @4xl/pane:-mx-1 @4xl/pane:px-1',
      )}
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
