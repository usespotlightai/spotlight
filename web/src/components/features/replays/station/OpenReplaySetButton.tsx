import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ReplaySetNameDialog } from '@/components/features/replays/ReplaySetNameDialog';
import { Button } from '@/components/ui/button';
import { useOpenReplaySet } from '@/hooks/api/useOpenReplaySet';
import { type ReplayedStation, replaySetPath } from '@/lib/replay';
import { useForwardTrail } from '@/lib/trail';

type OpenReplaySetButtonProps = {
  at: ReplayedStation;
};

export function OpenReplaySetButton({ at }: OpenReplaySetButtonProps) {
  const [open, setOpen] = useState(false);
  const opening = useOpenReplaySet();
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
        Open a replay set
      </Button>

      <ReplaySetNameDialog
        open={open}
        onOpenChange={setOpen}
        title="Open a replay set"
        description="Name the set, then pick the past runs to replay in it."
        submit="Open set"
        submitting="Opening…"
        pending={opening.isPending}
        error={opening.error}
        onClosed={() => opening.reset()}
        onSubmit={(name) =>
          opening.mutate(
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
