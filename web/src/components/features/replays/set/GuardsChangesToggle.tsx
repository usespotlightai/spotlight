import { useId } from 'react';
import { ReplayCheckThreshold } from '@/components/features/replays/ReplayCheckThreshold';
import { Switch } from '@/components/ui/switch';
import { useGuardChanges } from '@/hooks/api/useGuardChanges';
import { conflicted, messageOf } from '@/lib/error';
import type { ReplaySet } from '@/lib/replay';
import type { LineReplayCheck } from '@/lib/search';

export const GUARDS_ANCHOR = 'guards-changes';

const GUARDED_ELSEWHERE =
  'Another replay set at this station guards its changes already. Turn it off there first.';

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
  const refused = guard.isError
    ? conflicted(guard.error)
      ? GUARDED_ELSEWHERE
      : messageOf(guard.error, 'Could not change what the set guards')
    : null;

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
        When it does, <code className="font-mono">spotlight replay check</code>{' '}
        replays a pull request’s planned change of this station on this set, and
        fails the check past the line’s regression threshold. A station has at
        most one such set.
      </p>
      {replayCheck !== undefined && (
        <ReplayCheckThreshold replayCheck={replayCheck} />
      )}
      {refused && (
        <p role="alert" className="text-destructive text-xs">
          {refused}
        </p>
      )}
    </div>
  );
}
