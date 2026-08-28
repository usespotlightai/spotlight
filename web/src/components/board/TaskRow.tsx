import { Link } from 'react-router';
import { StationIcon } from '@/components/board/StationIcon';
import { Checkbox } from '@/components/ui/checkbox';
import { raisedOn, type Task } from '@/lib/task';
import { cn } from '@/lib/utils';

type TaskRowProps = {
  task: Task;
  to: string;
  stationColor: string;
  stationShare: number;
  selected: boolean;
  mergeTop: boolean;
  mergeBottom: boolean;
  onSelectedChange: (selected: boolean) => void;
};

export function TaskRow({
  task,
  to,
  stationColor,
  stationShare,
  selected,
  mergeTop,
  mergeBottom,
  onSelectedChange,
}: TaskRowProps) {
  return (
    <li
      data-slot="task-row"
      className={cn(
        'group/task relative mx-1.5 rounded-md first:mt-0.5 last:mb-0.5',
        mergeTop && 'rounded-t-none',
        mergeBottom && 'rounded-b-none',
      )}
    >
      <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex w-4 items-center justify-center">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelectedChange}
          aria-label={`Select ${task.title}`}
          className={cn(
            'pointer-events-auto opacity-0 transition-opacity',
            'focus-visible:opacity-100 group-hover/task:opacity-100',
            selected && 'opacity-100',
          )}
        />
      </span>

      <div
        className={cn(
          'flex h-10 min-w-0 items-center gap-2 rounded-[inherit] px-3 transition-colors',
          selected ? 'bg-selected' : 'group-hover/task:bg-accent',
        )}
      >
        <span className="w-4 shrink-0" aria-hidden />

        <StationIcon
          share={stationShare}
          color={stationColor}
          className="-mr-1.5"
        />

        <span className="flex min-w-0 flex-1 pl-1.5">
          <Link
            to={to}
            className="truncate text-foreground text-sm outline-none"
          >
            {task.title}
          </Link>
        </span>

        <time
          dateTime={task.createdAt}
          className="shrink-0 text-muted-foreground text-xs tabular-nums"
        >
          {raisedOn(task.createdAt)}
        </time>
      </div>
    </li>
  );
}
