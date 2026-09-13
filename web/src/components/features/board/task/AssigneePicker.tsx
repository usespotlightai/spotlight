import { Check, ChevronsUpDown, UserRound } from 'lucide-react';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

function Unclaimed({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border border-muted-foreground/60 border-dashed text-muted-foreground',
        className,
      )}
    >
      <UserRound className="size-3" aria-hidden />
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

  const give = (person: Person | null) =>
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
            <Unclaimed className="size-4" />
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
        <DropdownMenuTrigger
          // Keep a click on the picker from starting a drag on the row.
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={label}
          className={cn(
            'shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          {assignee ? <PersonAvatar person={assignee} /> : <Unclaimed />}
        </DropdownMenuTrigger>
      )}

      <DropdownMenuContent
        align={variant === 'row' ? 'start' : 'end'}
        className="w-44"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem closeOnClick onClick={() => give(null)}>
            <Unclaimed className="size-4" />
            <span className="flex-1 truncate text-foreground">No assignee</span>
            {!assignee && (
              <Check className="size-4 text-foreground" aria-hidden />
            )}
          </DropdownMenuItem>

          {(members ?? []).map((member) => (
            <DropdownMenuItem
              key={member.id}
              closeOnClick
              onClick={() => give(member)}
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
