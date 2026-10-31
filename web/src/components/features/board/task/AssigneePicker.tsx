import { Check, ChevronsUpDown, UserRound } from 'lucide-react';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAssignTask } from '@/hooks/api/useAssignTask';
import { useMembers } from '@/hooks/api/useMembers';
import type { Task } from '@/lib/task';
import { cn } from '@/lib/utils';

type Person = { id: string; name: string; image: string | null };

type AssigneePickerProps = {
  teamId: string;
  task: Task;
  variant?: 'avatar' | 'row';
  className?: string;
};

const RING_WIDTH = { sm: 1.5, md: 1 } as const;

function Unclaimed({ size = 'md' }: { size?: keyof typeof RING_WIDTH }) {
  const width = RING_WIDTH[size];

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center text-muted-foreground',
        size === 'sm' ? 'size-4' : 'size-6',
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="absolute inset-0 size-full -rotate-90 text-muted-foreground/40"
        aria-hidden
      >
        <circle
          cx="12"
          cy="12"
          r={12 - width / 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={width}
          pathLength="30"
          strokeDasharray="3 2"
          strokeDashoffset="1.5"
        />
      </svg>
      <UserRound className="size-2.5" aria-hidden />
    </span>
  );
}

export function AssigneePicker({
  teamId,
  task,
  variant = 'avatar',
  className,
}: AssigneePickerProps) {
  const { data: members } = useMembers(teamId);
  const { mutate } = useAssignTask();

  const assignee = task.assignee;
  const label = assignee ? `Assigned to ${assignee.name}` : 'Assign this task';

  const assign = (person: Person | null) =>
    mutate({ teamId, taskId: task.id, assignee: person });

  return (
    <DropdownMenu>
      {variant === 'row' ? (
        <DropdownMenuTrigger
          aria-label={label}
          className={cn(
            'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent',
            className,
          )}
        >
          {assignee ? (
            <PersonAvatar
              person={assignee}
              className="size-4 data-[size=sm]:size-4"
            />
          ) : (
            <Unclaimed size="sm" />
          )}
          <span
            className={cn(
              'truncate',
              assignee ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {assignee ? assignee.name : 'No assignee'}
          </span>
          <ChevronsUpDown
            className="ml-auto size-3 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </DropdownMenuTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                onPointerDown={(event) => event.stopPropagation()}
                aria-label={label}
                className={cn(
                  'shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  className,
                )}
              />
            }
          >
            {assignee ? <PersonAvatar person={assignee} /> : <Unclaimed />}
          </TooltipTrigger>
          <TooltipContent>
            {assignee ? assignee.name : 'No assignee'}
          </TooltipContent>
        </Tooltip>
      )}

      <DropdownMenuContent
        align={variant === 'row' ? 'start' : 'end'}
        className="w-44"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem closeOnClick onClick={() => assign(null)}>
            <Unclaimed size="sm" />
            <span className="flex-1 truncate text-foreground">No assignee</span>
            {!assignee && (
              <Check className="size-4 text-foreground" aria-hidden />
            )}
          </DropdownMenuItem>

          {(members ?? []).map((member) => (
            <DropdownMenuItem
              key={member.id}
              closeOnClick
              onClick={() => assign(member)}
            >
              <PersonAvatar
                person={member}
                className="size-4 data-[size=sm]:size-4"
              />
              <span className="flex-1 truncate text-foreground">
                {member.name}
              </span>
              {assignee?.id === member.id && (
                <Check className="size-4 text-foreground" aria-hidden />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
