import { EffortSteps } from '@/components/features/stations/config/EffortSteps';
import {
  Property,
  PropertyList,
} from '@/components/features/stations/config/PropertyList';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { TabSection } from '@/components/features/stations/TabSection';
import { useStationAgent } from '@/hooks/useStationAgent';
import type { StationResponseDto } from '@/lib/api';

export function AgentProperties({ station }: { station: StationResponseDto }) {
  const agent = useStationAgent(station);

  return (
    <TabSection title="Agent">
      {agent ? (
        <PropertyList>
          <Property label="Harness" slot="station-agent">
            <span className="flex items-center gap-2">
              <HarnessLogo harness={agent.harnessId} />
              {agent.harness}
            </span>
          </Property>
          <Property label="Model">{agent.model}</Property>
          {agent.effort && (
            <Property label="Effort">
              <span className="flex items-center gap-2">
                {agent.effort.name}
                <EffortSteps effort={agent.effort} />
              </span>
            </Property>
          )}
        </PropertyList>
      ) : (
        <p data-slot="station-agent" className="text-muted-foreground text-sm">
          No agent. Please pick a harness in Terraform.
        </p>
      )}
    </TabSection>
  );
}
