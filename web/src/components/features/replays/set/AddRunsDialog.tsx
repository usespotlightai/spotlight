import type { ReactNode } from 'react';
import { ReplayableRunRow } from '@/components/features/replays/set/ReplayableRunRow';
import { SuggestedRuns } from '@/components/features/replays/set/SuggestedRuns';
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
import { useReplaySetSuggestions } from '@/hooks/api/useReplaySetSuggestions';
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
  const setRunIds = new Set(set.entries.map((each) => each.runId));
  const suggestions = useReplaySetSuggestions(at.teamId, set.id, open);
  const suggested = new Set((suggestions.data ?? []).map((each) => each.runId));
  const listed = (runs.data ?? []).filter((each) => !suggested.has(each.runId));
  const adding = (runId: string) =>
    add.isPending && add.variables?.runId === runId;
  const addRun = (runId: string) =>
    add.mutate({ teamId: at.teamId, setId: set.id, runId });

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
  } else if ((runs.data ?? []).length === 0) {
    body = (
      <p className="px-2 py-6 text-center text-muted-foreground text-sm">
        No ended runs to replay yet. Runs appear here once they end.
      </p>
    );
  } else if (listed.length > 0) {
    body = (
      <ul aria-label="The station’s recent runs" className="flex flex-col">
        {listed.map((run) => (
          <ReplayableRunRow
            key={run.runId}
            run={run}
            inSet={setRunIds.has(run.runId)}
            adding={adding(run.runId)}
            onAdd={() => addRun(run.runId)}
          />
        ))}
      </ul>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(open) => !open && add.reset()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add runs to {set.name}</DialogTitle>
          <DialogDescription>
            The station’s latest ended runs. Spotlight keeps a run’s starting
            workspace while it’s in the set.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-2 flex max-h-[min(60vh,28rem)] flex-col gap-2 overflow-y-auto">
          <SuggestedRuns
            suggestions={suggestions}
            setRunIds={setRunIds}
            adding={adding}
            onAdd={addRun}
          />
          {body}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Done
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
