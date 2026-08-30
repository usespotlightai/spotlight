import { ReviewMarker } from '@/components/runs/ReviewMarker';
import { RunRow } from '@/components/runs/RunRow';
import { useTaskRuns } from '@/hooks/api/useTaskRuns';
import { runPath } from '@/lib/run';

type TaskActivityProps = {
  slug: string | undefined;
  teamId: string | undefined;
  taskId: string;
};

export function TaskActivity({ slug, teamId, taskId }: TaskActivityProps) {
  const { data: runs } = useTaskRuns(teamId, taskId);

  const worked = runs ?? [];

  if (worked.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 border-border border-t pt-6">
      <h2 className="font-semibold text-foreground text-sm">Activity</h2>

      <ul className="flex flex-col gap-0.5">
        {worked.flatMap((run) => [
          run.review && (
            <ReviewMarker
              key={`${run.id}-review`}
              slug={slug}
              conversationId={run.review.conversationId}
              at={run.updatedAt}
            />
          ),
          <RunRow
            key={run.id}
            run={run}
            to={slug && teamId ? runPath(slug, teamId, run.id) : ''}
            inTrail
          />,
        ])}
      </ul>
    </section>
  );
}
