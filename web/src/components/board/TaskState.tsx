import type { Task } from '@/lib/task';
import { cn } from '@/lib/utils';

const PILL =
  'flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-2.5 pl-2 font-medium text-muted-foreground text-xs';

/**
 * The two things a task can be doing that a person would want to see without
 * opening it: being worked, and waiting on them. Standing quietly at a station
 * is the ordinary case and says nothing.
 */
export function TaskState({ task }: { task: Task }) {
  const state = task.awaitingReview
    ? { label: 'Awaiting review', dot: 'bg-amber-500' }
    : task.running
      ? { label: 'In progress', dot: 'bg-primary' }
      : null;

  if (!state) {
    return null;
  }

  return (
    <span className={PILL}>
      <span
        className={cn('size-2 shrink-0 rounded-full', state.dot)}
        aria-hidden
      />
      {state.label}
    </span>
  );
}
