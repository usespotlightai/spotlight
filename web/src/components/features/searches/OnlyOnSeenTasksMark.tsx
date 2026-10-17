import { NotedWarning } from '@/components/shared/NotedWarning';
import {
  formatOnlyOnSeenTasks,
  type OnlyOnSeenTasks,
  onlyOnSeenTasksNote,
} from '@/lib/search-words';

export function OnlyOnSeenTasksMark({ mark }: { mark: OnlyOnSeenTasks }) {
  return (
    <NotedWarning
      data-slot="only-on-seen-tasks"
      data-mark={mark}
      tone={mark === 'marked' ? 'warning' : 'muted'}
      label={formatOnlyOnSeenTasks(mark)}
      note={onlyOnSeenTasksNote(mark)}
      className="relative z-10"
    />
  );
}
