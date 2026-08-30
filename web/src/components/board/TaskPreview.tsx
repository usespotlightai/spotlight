import { StationIcon } from '@/components/board/StationIcon';
import { raisedOn, type Task } from '@/lib/task';

type TaskPreviewProps = {
  task: Task;
  stationColor: string;
  stationShare: number;
};

export function TaskPreview({
  task,
  stationColor,
  stationShare,
}: TaskPreviewProps) {
  return (
    <div
      data-slot="task-preview"
      className="flex h-10 cursor-grabbing items-center gap-2 rounded-md bg-popover px-3 shadow-overlay ring-1 ring-foreground/10"
    >
      <span className="w-4 shrink-0" aria-hidden />

      <StationIcon
        share={stationShare}
        color={stationColor}
        className="-mr-1.5"
      />

      <span className="min-w-0 flex-1 truncate pl-1.5 text-foreground text-sm">
        {task.title}
      </span>

      <time
        dateTime={task.createdAt}
        className="shrink-0 text-muted-foreground text-xs tabular-nums"
      >
        {raisedOn(task.createdAt)}
      </time>
    </div>
  );
}
