import type { ReactNode } from 'react';

import { MoveMarker } from '@/components/features/runs/MoveMarker';
import { ReviewMarker } from '@/components/features/runs/ReviewMarker';
import { RunRow } from '@/components/features/runs/RunRow';
import { useTaskMoves } from '@/hooks/api/useTaskMoves';
import { useTaskRuns } from '@/hooks/api/useTaskRuns';
import type { TaskHoldResponseDto } from '@/lib/api';
import { nonEmpty } from '@/lib/non-empty';
import { runPath } from '@/lib/run';

type TaskActivityProps = {
  slug: string | undefined;
  teamId: string | undefined;
  taskId: string;
  hold: TaskHoldResponseDto | null;
};

type Entry = { readonly at: string; readonly rows: ReactNode[] };

const newestFirst = (runsNewestFirst: Entry[], moves: Entry[]): Entry[] => {
  const left = moves.toSorted(
    (one, other) => Date.parse(other.at) - Date.parse(one.at),
  );
  const merged: Entry[] = [];

  for (const run of runsNewestFirst) {
    const firstAtOrBefore = left.findIndex(
      (move) => Date.parse(move.at) <= Date.parse(run.at),
    );

    merged.push(
      ...left.splice(0, firstAtOrBefore === -1 ? left.length : firstAtOrBefore),
      run,
    );
  }

  return [...merged, ...left];
};

export function TaskActivity({
  slug,
  teamId,
  taskId,
  hold,
}: TaskActivityProps) {
  const { data: runs } = useTaskRuns(teamId, taskId);
  const { data: moves } = useTaskMoves(teamId, taskId);

  const entries = newestFirst(
    (runs ?? []).map((run) => ({
      at: run.startedAt,
      rows: [
        run.review && (run.waitingForYou || run.review.state !== 'pending') && (
          <ReviewMarker
            key={`${run.id}-review`}
            slug={slug}
            review={run.review}
            runId={run.id}
            at={run.updatedAt}
          />
        ),
        <RunRow
          key={run.id}
          run={run}
          teamId={teamId}
          to={
            nonEmpty(slug) && nonEmpty(teamId)
              ? runPath(slug, teamId, run.id)
              : ''
          }
          inTrail
          onHold={hold?.runId === run.id ? hold : null}
        />,
      ],
    })),
    (moves ?? []).map((move) => ({
      at: move.at,
      rows: [<MoveMarker key={`move-${move.position}`} move={move} />],
    })),
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 border-border border-t pt-6">
      <h2 className="font-semibold text-foreground text-sm">Activity</h2>

      <ul className="flex flex-col gap-0.5">
        {entries.flatMap((entry) => entry.rows)}
      </ul>
    </section>
  );
}
