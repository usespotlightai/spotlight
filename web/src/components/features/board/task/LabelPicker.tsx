import { Check, ChevronsUpDown, Tag } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLabelTask } from '@/hooks/api/useLabelTask';
import { useLabels } from '@/hooks/api/useLabels';
import { useUnlabelTask } from '@/hooks/api/useUnlabelTask';
import type { Task } from '@/lib/task';

type LabelPickerProps = {
  teamId: string;
  task: Task;
};

export function LabelPicker({ teamId, task }: LabelPickerProps) {
  const { data: available } = useLabels(teamId);
  const labelTask = useLabelTask();
  const unlabelTask = useUnlabelTask();

  const applied = task.labels ?? [];
  const isApplied = (labelId: string) =>
    applied.some((each) => each.id === labelId);

  const toggle = (labelId: string) => {
    if (isApplied(labelId)) {
      unlabelTask.mutate({ teamId, taskId: task.id, labelId });
    } else {
      labelTask.mutate({ teamId, taskId: task.id, labelId });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Labels"
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden />

        {applied.length === 0 ? (
          <span className="flex-1 truncate text-muted-foreground">
            No labels
          </span>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-1">
            {applied.map((label) => (
              <span
                key={label.id}
                className="inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
                style={{ backgroundColor: label.colour }}
              >
                {label.name}
              </span>
            ))}
          </span>
        )}

        <ChevronsUpDown
          className="ml-auto size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          {(available ?? []).length === 0 ? (
            <DropdownMenuItem disabled>No labels defined</DropdownMenuItem>
          ) : (
            (available ?? []).map((label) => (
              <DropdownMenuItem
                key={label.id}
                closeOnClick={false}
                onClick={() => toggle(label.id)}
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: label.colour }}
                  aria-hidden
                />
                <span className="flex-1 truncate text-foreground">
                  {label.name}
                </span>
                {isApplied(label.id) && (
                  <Check className="size-4 text-foreground" aria-hidden />
                )}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
