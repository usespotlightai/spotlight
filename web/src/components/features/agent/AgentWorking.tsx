import { HarnessLogo } from '@/components/features/stations/HarnessLogo';

export function AgentWorking({ harness }: { harness: string }) {
  return (
    <li className="flex items-center gap-1.5 px-1 text-xs leading-6">
      <span className="flex size-6 shrink-0 items-center justify-center">
        <HarnessLogo harness={harness} />
      </span>
      <span className="animate-pulse">The agent is working…</span>
    </li>
  );
}
