import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
import type { TeamRun } from '@/lib/run';
import { taskPath } from '@/lib/task';
import { cn } from '@/lib/utils';

type RunEmptyProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
};

export function RunEmpty({ slug, teamId, run }: RunEmptyProps) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 text-center">
      <p className="text-muted-foreground text-sm">
        {run.state === 'failed'
          ? 'This run failed before any work was done.'
          : 'This run ended before any work was done.'}
      </p>

      {run.taskId && (
        <TrailLink
          to={taskPath(slug, teamId, run.taskId)}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'rounded-full bg-card shadow-none',
          )}
        >
          Open the task
        </TrailLink>
      )}
    </div>
  );
}
