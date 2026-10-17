import { TriangleAlert } from 'lucide-react';
import { Noted } from '@/components/shared/Noted';
import { Pill } from '@/components/shared/Pill';
import {
  formatOnlyOnSeenTasks,
  type OnlyOnSeenTasks,
  onlyOnSeenTasksNote,
} from '@/lib/search-words';
import { cn } from '@/lib/utils';

type OnlyOnSeenTasksBadgeProps = {
  mark: OnlyOnSeenTasks;
  className?: string;
};

export function OnlyOnSeenTasksBadge({
  mark,
  className,
}: OnlyOnSeenTasksBadgeProps) {
  return (
    <Noted note={onlyOnSeenTasksNote(mark)}>
      <span
        data-slot="only-on-seen-tasks"
        data-mark={mark}
        className={cn('inline-flex', className)}
      >
        {mark === 'marked' ? (
          <Pill
            lead={<TriangleAlert aria-hidden className="size-3" />}
            className={cn(
              'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
            )}
          >
            {formatOnlyOnSeenTasks(mark)}
          </Pill>
        ) : (
          <span className="text-muted-foreground text-xs">
            {formatOnlyOnSeenTasks(mark)}
          </span>
        )}
      </span>
    </Noted>
  );
}
