import { HarnessLogo } from '@/components/features/stations/HarnessLogo';

type AgentWorkingProps = {
  harness: string;
  queued: boolean;
};

export function AgentWorking({ harness, queued }: AgentWorkingProps) {
  return (
    <li className="flex items-center gap-1.5 px-1 text-xs leading-6">
      <span className="flex size-6 shrink-0 items-center justify-center">
        <HarnessLogo harness={harness} />
      </span>
      {queued ? (
        <span className="text-muted-foreground">
          Queued. The agent starts when a runner is free.
        </span>
      ) : (
        <span className="animate-pulse">The agent is working…</span>
      )}
    </li>
  );
}
