import { type LucideIcon, Play } from 'lucide-react';
import { useState } from 'react';
import { StartReplayDialog } from '@/components/features/replays/set/StartReplayDialog';
import { Button } from '@/components/ui/button';
import type { Replay, ReplayedStation, ReplaySet } from '@/lib/replay';
import { START_REPLAY } from '@/lib/replay-words';

type StartReplayButtonProps = {
  at: ReplayedStation;
  set: ReplaySet;
  baseline: Pick<Replay, 'repeats'> | null;
  refusedBecause: string | null;
  label?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'outline';
  firstRepeats?: number;
  firstCandidate?: string;
};

export function StartReplayButton({
  at,
  set,
  baseline,
  refusedBecause,
  label = START_REPLAY,
  icon: Icon = Play,
  variant = 'default',
  firstRepeats,
  firstCandidate,
}: StartReplayButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        variant={variant}
        size="sm"
        className="rounded-full"
        disabled={refusedBecause !== null}
        onClick={() => setOpen(true)}
      >
        <Icon aria-hidden />
        {label}
      </Button>
      {refusedBecause && (
        <span className="text-muted-foreground text-xs">{refusedBecause}</span>
      )}

      <StartReplayDialog
        at={at}
        set={set}
        baseline={baseline}
        firstRepeats={firstRepeats}
        firstCandidate={firstCandidate}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
