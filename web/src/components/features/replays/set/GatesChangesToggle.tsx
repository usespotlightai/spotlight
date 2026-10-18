import { useId } from 'react';
import { Switch } from '@/components/ui/switch';
import { useGateChanges } from '@/hooks/api/useGateChanges';
import type { ReplaySet } from '@/lib/replay';

type GatesChangesToggleProps = {
  teamId: string;
  set: ReplaySet;
};

export function GatesChangesToggle({ teamId, set }: GatesChangesToggleProps) {
  const gate = useGateChanges();
  const id = useId();

  return (
    <label
      htmlFor={id}
      data-slot="gates-changes"
      className="flex w-fit select-none items-center gap-2 text-foreground text-xs"
    >
      <Switch
        id={id}
        checked={set.gatesChanges}
        disabled={gate.isPending || set.stationGone}
        onCheckedChange={(gates) =>
          gate.mutate({ teamId, setId: set.id, gates })
        }
      />
      Gates config changes
    </label>
  );
}
