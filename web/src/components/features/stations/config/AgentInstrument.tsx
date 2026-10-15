import { EffortMeter } from '@/components/features/stations/config/EffortMeter';
import { Instrument } from '@/components/features/stations/config/Instrument';
import { InstrumentValue } from '@/components/features/stations/config/InstrumentValue';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { useStationAgent } from '@/hooks/useStationAgent';
import type { StationResponseDto } from '@/lib/api';

export function AgentInstrument({ station }: { station: StationResponseDto }) {
  const agent = useStationAgent(station);

  return (
    <Instrument title="Agent">
      <div data-slot="station-agent">
        {agent ? (
          <InstrumentValue
            lead={<HarnessLogo harness={agent.harnessId} className="size-4" />}
            detail={agent.harness}
          >
            {agent.model}
          </InstrumentValue>
        ) : (
          <InstrumentValue detail="Please pick a harness in Terraform.">
            <span className="text-muted-foreground">No agent</span>
          </InstrumentValue>
        )}
      </div>

      {agent?.effort && <EffortMeter effort={agent.effort} />}
    </Instrument>
  );
}
