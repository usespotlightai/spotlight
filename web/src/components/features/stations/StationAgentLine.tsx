import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { useStationAgent } from '@/hooks/useStationAgent';

type StationAgentLineProps = {
  harness: string | null | undefined;
  model: string | null | undefined;
  effort: string | null | undefined;
};

export function StationAgentLine(props: StationAgentLineProps) {
  const agent = useStationAgent(props);
  const parts = agent
    ? [agent.harness, agent.model, ...(agent.effort ? [agent.effort] : [])]
    : ['No agent'];

  return (
    <p
      data-slot="station-agent"
      className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-sm"
    >
      <HarnessLogo harness={agent?.harnessId} />
      <span className="truncate">{parts.join(' · ')}</span>
    </p>
  );
}
