import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { EffortMeter } from '@/components/features/stations/config/EffortMeter';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { useStationAgent } from '@/hooks/useStationAgent';
import type { StationResponseDto } from '@/lib/api';

export function AgentCard({ station }: { station: StationResponseDto }) {
  const agent = useStationAgent(station);

  return (
    <ConfigCard title="Agent">
      <div data-slot="station-agent">
        {agent ? (
          <ConfigCardValue
            lead={<HarnessLogo harness={agent.harnessId} className="size-4" />}
            detail={agent.harness}
          >
            {agent.model}
          </ConfigCardValue>
        ) : (
          <ConfigCardValue detail="Please pick a harness in Terraform.">
            <span className="text-muted-foreground">No agent</span>
          </ConfigCardValue>
        )}
      </div>

      {agent?.effort && <EffortMeter effort={agent.effort} />}
    </ConfigCard>
  );
}
