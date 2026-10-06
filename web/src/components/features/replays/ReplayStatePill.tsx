import { Pill } from '@/components/shared/Pill';
import { type ReplayState, stateNote, stateShown } from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const INK: Record<ReplayState, string> = {
  queued: 'text-muted-foreground',
  running: 'text-foreground',
  finished: 'text-muted-foreground',
  stopped: 'text-muted-foreground',
  'over-budget': 'text-destructive',
};

type ReplayStatePillProps = {
  state: ReplayState;
  className?: string;
};

export function ReplayStatePill({ state, className }: ReplayStatePillProps) {
  return (
    <Pill className={cn(INK[state], className)}>
      <span title={stateNote(state) ?? undefined}>{stateShown(state)}</span>
    </Pill>
  );
}
