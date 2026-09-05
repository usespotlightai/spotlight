import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router';
import { AssigneePicker } from '@/components/board/AssigneePicker';
import { DropIndicator } from '@/components/board/DropIndicator';
import { StationIcon } from '@/components/board/StationIcon';
import { TaskState } from '@/components/board/TaskState';
import { Checkbox } from '@/components/ui/checkbox';
import { raisedOn, type Task } from '@/lib/task';
import { cn } from '@/lib/utils';

type TaskRowProps = {
  task: Task;
  teamId: string;
  to: string;
  reviewTo?: string;
  stationColor: string;
  stationShare: number;
  selected: boolean;
  landing?: 'above' | 'below';
  mergeTop: boolean;
  mergeBottom: boolean;
  onSelectedChange: (selected: boolean) => void;
};

export function TaskRow({
  task,
  teamId,
  to,
  reviewTo,
  stationColor,
  stationShare,
  selected,
  landing,
  mergeTop,
  mergeBottom,
  onSelectedChange,
}: TaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { kind: 'task', stationId: task.stationId },
    animateLayoutChanges: () => false,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      data-slot="task-row"
      className={cn(
        'group/task relative mx-1.5 touch-none select-none rounded-md first:mt-0.5 last:mb-0.5',
        isDragging && 'opacity-40',
        mergeTop && 'rounded-t-none',
        mergeBottom && 'rounded-b-none',
      )}
    >
      {landing && (
        <DropIndicator edge={landing === 'above' ? 'top' : 'bottom'} />
      )}

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
            draggable={false}
            className="truncate text-foreground text-sm outline-none"
          >
            {task.title}
          </Link>
        </span>

        <TaskState task={task} reviewTo={reviewTo} />

        <AssigneePicker teamId={teamId} task={task} className="-ml-1" />

        <time
          dateTime={task.createdAt}
          className="ml-2 w-20 shrink-0 text-right text-muted-foreground text-xs tabular-nums"
        >
          {raisedOn(task.createdAt)}
        </time>
      </div>
    </li>
  );
}
