import { useId } from 'react';
import { Switch } from '@/components/ui/switch';
import { useGuardChanges } from '@/hooks/api/useGuardChanges';
import type { ReplaySet } from '@/lib/replay';

type GuardsChangesToggleProps = {
  teamId: string;
  set: ReplaySet;
};

export function GuardsChangesToggle({ teamId, set }: GuardsChangesToggleProps) {
  const guard = useGuardChanges();
  const id = useId();

  return (
    <label
      htmlFor={id}
      data-slot="guards-changes"
      className="flex w-fit select-none items-center gap-2 text-foreground text-xs"
    >
      <Switch
        id={id}
        checked={set.guardsChanges}
        disabled={guard.isPending || set.stationGone}
        onCheckedChange={(guards) =>
          guard.mutate({ teamId, setId: set.id, guards })
        }
      />
      Guards config changes
    </label>
  );
}
