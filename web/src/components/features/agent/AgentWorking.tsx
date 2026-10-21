import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import type { Progress } from '@/lib/run';

type AgentWorkingProps = {
  harness: string;
  progress: Progress;
};

export function AgentWorking({ harness, progress }: AgentWorkingProps) {
  return (
    <li className="flex items-center gap-1.5 px-1 text-xs leading-6">
      <span className="flex size-6 shrink-0 items-center justify-center">
        <HarnessLogo harness={harness} />
      </span>
      {progress === 'queued' ? (
        <span className="text-muted-foreground">
          Queued. The agent starts when a runner is free.
        </span>
      ) : (
        <span className="animate-pulse">The agent is working…</span>
      )}
    </li>
  );
}
