import { Play } from 'lucide-react';
import { useState } from 'react';
import { StartReplayDialog } from '@/components/features/replays/set/StartReplayDialog';
import { Button } from '@/components/ui/button';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';

type StartReplayButtonProps = {
  at: ReplayedStation;
  set: ReplaySet;
  hasBaseline: boolean;
  refusedBecause: string | null;
};

export function StartReplayButton({
  at,
  set,
  hasBaseline,
  refusedBecause,
}: StartReplayButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        size="sm"
        className="rounded-full"
        disabled={refusedBecause !== null}
        onClick={() => setOpen(true)}
      >
        <Play aria-hidden />
        Start a replay
      </Button>
      {refusedBecause && (
        <span className="text-muted-foreground text-xs">{refusedBecause}</span>
      )}

      <StartReplayDialog
        at={at}
        set={set}
        hasBaseline={hasBaseline}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
