import { SettingRows } from '@/components/features/stations/config/SettingRows';
import { StationSkills } from '@/components/features/stations/config/StationSkills';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { StationSection } from '@/components/features/stations/StationSection';
import { useStationAgent } from '@/hooks/useStationAgent';
import type { StationResponseDto } from '@/lib/api';

export function StationAgentSettings({
  station,
}: {
  station: StationResponseDto;
}) {
  const agent = useStationAgent(station);

  return (
    <StationSection title="Agent">
      <SettingRows
        rows={[
          {
            label: 'Harness',
            value: (
              <span className="flex items-center gap-1.5">
                <HarnessLogo harness={agent?.harnessId} />
                {agent?.harness ?? 'No agent'}
              </span>
            ),
          },
          ...(agent
            ? [
                { label: 'Model', value: agent.model },
                ...(agent.effort
                  ? [{ label: 'Effort', value: agent.effort }]
                  : []),
              ]
            : []),
          {
            label: 'Skills',
            value: <StationSkills skills={station.skills} />,
          },
        ]}
      />
    </StationSection>
  );
}
