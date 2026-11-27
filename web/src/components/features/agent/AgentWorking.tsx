import { AgentQueued } from '@/components/features/agent/AgentQueued';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { useElapsed } from '@/hooks/useElapsed';
import type { AgentPhase } from '@/lib/chat';
import { doingOf } from '@/lib/journal-step';
import type { Progress } from '@/lib/run';

type AgentWorkingProps = {
  slug: string;
  harness: string;
  progress: Progress;
  phase: AgentPhase;
};

const SHOWN_AFTER_MS = 5_000;

const ticking = (ms: number): string => {
  const seconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(seconds / 60);

  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
};

const doing = (phase: AgentPhase): string => {
  if (phase.kind === 'step') {
    return `${doingOf(phase.step)}…`;
  }

  return phase.kind === 'preparing'
    ? 'Preparing the workspace…'
    : 'The agent is working…';
};

function AgentDoing({ phase }: { phase: AgentPhase }) {
  const elapsed = useElapsed(phase.key, phase.since);

  return (
    <>
      <span className="min-w-0 truncate step-shine">{doing(phase)}</span>
      {elapsed >= SHOWN_AFTER_MS && (
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {ticking(elapsed)}
        </span>
      )}
    </>
  );
}

export function AgentWorking({
  slug,
  harness,
  progress,
  phase,
}: AgentWorkingProps) {
  return (
    <div className="flex items-center gap-1.5 px-1 text-xs leading-6">
      <span className="flex size-6 shrink-0 items-center justify-center">
        <HarnessLogo harness={harness} />
      </span>
      {progress === 'queued' ? (
        <AgentQueued slug={slug} />
      ) : progress === 'stopping' ? (
        <span className="animate-pulse text-muted-foreground">Stopping…</span>
      ) : (
        <AgentDoing phase={phase} />
      )}
    </div>
  );
}
