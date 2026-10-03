import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import { idleNoteOf, type TeamRun } from '@/lib/run';
import { taskPath } from '@/lib/task';
import { cn } from '@/lib/utils';

type RunEmptyProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
};

export function RunEmpty({ slug, teamId, run }: RunEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-muted-foreground text-sm">{idleNoteOf(run)}</p>

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
