import { useId } from 'react';
import { ReplayCheckThreshold } from '@/components/features/replays/ReplayCheckThreshold';
import { Switch } from '@/components/ui/switch';
import { useGuardChanges } from '@/hooks/api/useGuardChanges';
import type { ReplaySet } from '@/lib/replay';
import type { LineReplayCheck } from '@/lib/search';

export const GUARDS_ANCHOR = 'guards-changes';

type GuardsChangesToggleProps = {
  teamId: string;
  set: ReplaySet;
  replayCheck: LineReplayCheck | null | undefined;
};

export function GuardsChangesToggle({
  teamId,
  set,
  replayCheck,
}: GuardsChangesToggleProps) {
  const guard = useGuardChanges();
  const id = useId();
  const noteId = useId();

  return (
    <div
      id={GUARDS_ANCHOR}
      data-slot="guards-changes"
      className="flex scroll-mt-4 flex-col gap-1"
    >
      <label
        htmlFor={id}
        className="flex w-fit select-none items-center gap-2 text-foreground text-sm"
      >
        <Switch
          id={id}
          checked={set.guardsChanges}
          disabled={guard.isPending || set.stationGone}
          aria-describedby={noteId}
          onCheckedChange={(guards) =>
            guard.mutate({ teamId, setId: set.id, guards })
          }
        />
        Guards config changes
      </label>
      <p id={noteId} className="text-muted-foreground text-xs leading-5">
        <code className="font-mono">spotlight replay check</code> replays a pull
        request’s change of this station on this set. It fails past the line’s
        regression threshold. One such set per station.
      </p>
      {replayCheck !== undefined && (
        <ReplayCheckThreshold replayCheck={replayCheck} />
      )}
    </div>
  );
}
