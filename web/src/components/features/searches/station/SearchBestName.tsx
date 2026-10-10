import { NotedWarning } from '@/components/shared/NotedWarning';
import type { SearchBestResponseDto } from '@/lib/api';
import {
  noBestShown,
  onlyOnSeenTasksNote,
  onlyOnSeenTasksShown,
  type SearchObjective,
} from '@/lib/search-words';

type SearchBestNameProps = {
  best: SearchBestResponseDto | null;
  objective: SearchObjective;
};

export function SearchBestName({ best, objective }: SearchBestNameProps) {
  if (!best) {
    return (
      <span className="text-muted-foreground">{noBestShown(objective)}</span>
    );
  }

  const mark = best.onlyOnSeenTasks;

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-foreground">
        {best.seed ? 'Live config' : best.name}
      </span>
      {mark && (
        <NotedWarning
          data-slot="only-on-seen-tasks"
          data-mark={mark}
          note={`${onlyOnSeenTasksShown(mark)}. ${onlyOnSeenTasksNote(mark)}`}
          label={onlyOnSeenTasksShown(mark)}
          tone={mark === 'marked' ? 'warning' : 'muted'}
          className="relative z-10"
        />
      )}
    </span>
  );
}
