import { Play } from 'lucide-react';
import { StartReplayDialog } from '@/components/features/replays/set/StartReplayDialog';
import { DialogButton } from '@/components/shared/DialogButton';
import type { Replay, ReplayedStation, ReplaySet } from '@/lib/replay';
import { START_REPLAY } from '@/lib/replay-words';

type StartReplayButtonProps = {
  at: ReplayedStation;
  set: ReplaySet;
  baseline: Pick<Replay, 'repeats'> | null;
  refusedBecause: string | null;
};

export function StartReplayButton({
  at,
  set,
  baseline,
  refusedBecause,
}: StartReplayButtonProps) {
  return (
    <DialogButton
      label={START_REPLAY}
      icon={Play}
      variant="outline"
      refusedBecause={refusedBecause}
      dialog={(open, onOpenChange) => (
        <StartReplayDialog
          at={at}
          set={set}
          baseline={baseline}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  );
}
