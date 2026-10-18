import { Pill } from '@/components/shared/Pill';
import { formatState, type ReplayState, stateNote } from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const INK: Record<ReplayState, string> = {
  queued: 'text-muted-foreground',
  running: 'text-foreground',
  finished: 'text-muted-foreground',
  stopped: 'text-muted-foreground',
  'ceiling-reached': 'text-destructive',
};

type ReplayStatePillProps = {
  state: ReplayState;
  className?: string;
};

export function ReplayStatePill({ state, className }: ReplayStatePillProps) {
  return (
    <Pill className={cn(INK[state], className)}>
      <span title={stateNote(state) ?? undefined}>{formatState(state)}</span>
    </Pill>
  );
}
