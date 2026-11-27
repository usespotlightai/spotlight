import { useState } from 'react';

import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatState } from '@/lib/replay-words';
import { runPath } from '@/lib/run';
import {
  formatReplayRuns,
  formatRunProgress,
  type ImprovementSearch,
} from '@/lib/station-improvement';

type ReplayRunsDialogProps = {
  slug: string;
  teamId: string;
  search: ImprovementSearch;
};

export function ReplayRunsDialog({
  slug,
  teamId,
  search,
}: ReplayRunsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-foreground underline-offset-2 hover:underline"
      >
        {formatReplayRuns(search)}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-slot="replay-runs"
          className="flex max-h-[80svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]"
        >
          <DialogHeader className="gap-1 px-5 pt-5 pb-4">
            <DialogTitle>Replay runs of the last search</DialogTitle>
            <DialogDescription>
              Each replay run starts a past run again under a config. A task
              links to the past run it replays.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1" contentClassName="px-5 pb-5">
            {search.replays.map((replay) => (
              <section
                key={replay.replayId}
                aria-label={replay.candidate}
                className="pt-5 first:pt-0"
              >
                <h3 className="flex items-baseline justify-between gap-3 pb-2 font-medium text-foreground text-sm">
                  <span className="truncate">
                    {replay.live ? 'Live config' : replay.candidate}
                  </span>
                  <span className="shrink-0 font-normal text-muted-foreground">
                    {formatState(replay.state)}
                  </span>
                </h3>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {replay.runs.map((run, at) => (
                    <li
                      // oxlint-disable-next-line react/no-array-index-key -- a task replayed more than once repeats its past run
                      key={`${run.originalRunId}:${at}`}
                      data-slot="replay-run"
                      className="flex items-baseline justify-between gap-3"
                    >
                      <TrailLink
                        to={runPath(slug, teamId, run.originalRunId)}
                        className="min-w-0 truncate text-foreground hover:underline"
                      >
                        {run.taskTitle ?? 'Untitled task'}
                      </TrailLink>
                      <span className="shrink-0 text-muted-foreground">
                        {formatRunProgress(run)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
