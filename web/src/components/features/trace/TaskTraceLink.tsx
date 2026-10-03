import { Binoculars } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { taskTracePath } from '@/lib/task';

type TaskTraceLinkProps = {
  slug: string;
  teamId: string;
  taskId: string;
};

export function TaskTraceLink({ slug, teamId, taskId }: TaskTraceLinkProps) {
  return (
    <TrailLink
      to={taskTracePath(slug, teamId, taskId)}
      className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent"
    >
      <Binoculars
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />

      <span className="truncate text-foreground">View traces</span>
    </TrailLink>
  );
}
