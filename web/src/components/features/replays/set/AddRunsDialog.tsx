import type { ReactNode } from 'react';
import { ReplayableRunRow } from '@/components/features/replays/set/ReplayableRunRow';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAddReplaySetEntry } from '@/hooks/api/useAddReplaySetEntry';
import { useReplayableRuns } from '@/hooks/api/useReplayableRuns';
import { messageOf } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';

type AddRunsDialogProps = {
  at: ReplayedStation;
  set: ReplaySet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddRunsDialog({
  at,
  set,
  open,
  onOpenChange,
}: AddRunsDialogProps) {
  const runs = useReplayableRuns(at.teamId, at.lineId, at.stationId, open);
  const add = useAddReplaySetEntry();
  const held = new Set(set.entries.map((each) => each.runId));
  const listed = runs.data ?? [];

  let body: ReactNode;

  if (loading(runs)) {
    body = (
      <div
        role="status"
        aria-label="Loading the station’s runs"
        className="px-2 py-2"
      >
        <SkeletonLine className="w-48 text-sm" />
        <SkeletonLine className="w-32 text-xs" />
      </div>
    );
  } else if (failed(runs)) {
    body = (
      <CouldNotLoad
        what="The station’s runs"
        retrying={runs.isFetching}
        onRetry={() => void runs.refetch()}
        className="py-6"
      />
    );
  } else if (listed.length === 0) {
    body = (
      <p className="px-2 py-6 text-center text-muted-foreground text-sm">
        This station has no ended runs to replay yet.
      </p>
    );
  } else {
    body = (
      <ul aria-label="The station’s recent runs" className="flex flex-col">
        {listed.map((run) => (
          <ReplayableRunRow
            key={run.runId}
            run={run}
            inSet={held.has(run.runId)}
            adding={add.isPending && add.variables?.runId === run.runId}
            onAdd={() =>
              add.mutate({ teamId: at.teamId, setId: set.id, runId: run.runId })
            }
          />
        ))}
      </ul>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => !settled && add.reset()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add runs to {set.name}</DialogTitle>
          <DialogDescription>
            The station’s latest ended runs. While a run is in the set,
            Spotlight keeps the workspace it started from.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-2 max-h-[min(60vh,28rem)] overflow-y-auto">
          {body}
        </div>

        {add.isError && (
          <p role="alert" className="text-destructive text-xs">
            {messageOf(add.error, 'Could not add the run')}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Done
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
