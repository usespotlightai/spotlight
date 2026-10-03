import { AgentPicker } from '@/components/features/stations/AgentPicker';

type FixedAgentProps = {
  agent:
    | {
        readonly harness: string | null;
        readonly model: string | null;
        readonly effort: string | null;
      }
    | null
    | undefined;
};

export function FixedAgent({ agent }: FixedAgentProps) {
  return (
    <AgentPicker
      harness={agent?.harness ?? ''}
      model={agent?.model ?? ''}
      effort={agent?.effort ?? ''}
    />
  );
}
