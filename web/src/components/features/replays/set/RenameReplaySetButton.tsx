import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { ReplaySetNameDialog } from '@/components/features/replays/ReplaySetNameDialog';
import { Button } from '@/components/ui/button';
import { useRenameReplaySet } from '@/hooks/api/useRenameReplaySet';
import type { ReplaySet } from '@/lib/replay';

type RenameReplaySetButtonProps = {
  teamId: string;
  set: ReplaySet;
};

export function RenameReplaySetButton({
  teamId,
  set,
}: RenameReplaySetButtonProps) {
  const [open, setOpen] = useState(false);
  const rename = useRenameReplaySet();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full bg-card shadow-none"
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden />
        Rename
      </Button>

      <ReplaySetNameDialog
        key={set.name}
        open={open}
        onOpenChange={setOpen}
        title="Rename the replay set"
        description="Its runs and replays stay as they are."
        name={set.name}
        submit="Rename"
        submitting="Renaming…"
        pending={rename.isPending}
        error={rename.error}
        onClosed={() => rename.reset()}
        onSubmit={(name) =>
          rename.mutate(
            { teamId, setId: set.id, name },
            { onSuccess: () => setOpen(false) },
          )
        }
      />
    </>
  );
}
