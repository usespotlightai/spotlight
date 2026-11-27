import { ChevronsUpDown, Link2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBlockTask } from '@/hooks/api/useBlockTask';
import { useTasks } from '@/hooks/api/useTasks';
import { blockerCandidates, blockersNamed, type Task } from '@/lib/task';
import { cn } from '@/lib/utils';

type BlockedByPickerProps = {
  teamId: string;
  task: Task;
};

const labelOf = (task: Task): string =>
  blockersNamed(task, 'Blocked by') ?? 'Not blocked';

export function BlockedByPicker({ teamId, task }: BlockedByPickerProps) {
  const { data: tasks } = useTasks(teamId);
  const { mutate } = useBlockTask();
  const blocked = task.blockedBy.length > 0;
  const locked = !task.blockable && !blocked;
  const candidates = blockerCandidates(task, tasks ?? []);
  const chosen = new Set(task.blockedBy.map((each) => each.id));
  const shown = [
    ...task.blockedBy.filter(
      (each) => !candidates.some((other) => other.id === each.id),
    ),
    ...candidates.map(({ id, title }) => ({ id, title, teamId })),
  ];

  const toggle = (blocker: { id: string; title: string; teamId: string }) =>
    mutate({
      teamId,
      taskId: task.id,
      blockedBy: chosen.has(blocker.id)
        ? task.blockedBy.filter((each) => each.id !== blocker.id)
        : [...task.blockedBy, blocker],
    });

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              disabled={locked}
              aria-label="Blocked by"
              className={cn(
                'flex h-7 pointer-coarse:h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors data-[popup-open]:bg-accent',
                !locked && 'hover:bg-accent',
              )}
            />
          }
        >
          <Link2
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span
            className={cn(
              'truncate',
              blocked ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {labelOf(task)}
          </span>
          {!locked && (
            <ChevronsUpDown
              className="ml-auto size-3 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {locked
            ? 'Only a task in Backlog can wait for other tasks'
            : 'Choose the tasks it waits for. It starts when they are completed'}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="max-h-80 w-64">
        <DropdownMenuGroup>
          {shown.length === 0 && (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">
              No other open tasks
            </p>
          )}
          {shown.map((each) => (
            <DropdownMenuCheckboxItem
              key={each.id}
              checked={chosen.has(each.id)}
              disabled={!task.blockable && !chosen.has(each.id)}
              onCheckedChange={() => toggle(each)}
            >
              <span className="truncate">{each.title}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
