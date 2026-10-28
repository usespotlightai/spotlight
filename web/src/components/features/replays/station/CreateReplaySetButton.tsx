import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ReplaySetNameDialog } from '@/components/features/replays/ReplaySetNameDialog';
import { Button } from '@/components/ui/button';
import { useCreateReplaySet } from '@/hooks/api/useCreateReplaySet';
import { type ReplayedStation, replaySetPath } from '@/lib/replay';
import { useForwardTrail } from '@/lib/trail';

type CreateReplaySetButtonProps = {
  at: ReplayedStation;
};

export function CreateReplaySetButton({ at }: CreateReplaySetButtonProps) {
  const [open, setOpen] = useState(false);
  const creating = useCreateReplaySet();
  const navigate = useNavigate();
  const trail = useForwardTrail();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full bg-card shadow-none"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden />
        Create replay set
      </Button>

      <ReplaySetNameDialog
        open={open}
        onOpenChange={setOpen}
        title="Create a replay set"
        description="Name the set, then pick past runs to replay in it."
        submit="Create set"
        submitting="Creating…"
        pending={creating.isPending}
        onClosed={() => creating.reset()}
        onSubmit={(name) =>
          creating.mutate(
            { ...at, name },
            {
              onSuccess: (setId) => {
                setOpen(false);
                navigate(replaySetPath(at, setId), {
                  state: trail.length > 0 ? { trail } : undefined,
                });
              },
            },
          )
        }
      />
    </>
  );
}
