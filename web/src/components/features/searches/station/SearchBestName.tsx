import { TriangleAlert } from 'lucide-react';
import { Noted } from '@/components/shared/Noted';
import type { SearchBestResponseDto } from '@/lib/api';
import {
  noBestShown,
  onlyOnSeenTasksNote,
  onlyOnSeenTasksShown,
  type SearchObjective,
} from '@/lib/search-words';
import { cn } from '@/lib/utils';

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
        <Noted
          note={`${onlyOnSeenTasksShown(mark)}. ${onlyOnSeenTasksNote(mark)}`}
        >
          <span
            data-slot="only-on-seen-tasks"
            data-mark={mark}
            role="img"
            aria-label={onlyOnSeenTasksShown(mark)}
            className="relative z-10 inline-flex shrink-0"
          >
            <TriangleAlert
              aria-hidden
              className={cn(
                'size-3.5',
                mark === 'marked'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground',
              )}
            />
          </span>
        </Noted>
      )}
    </span>
  );
}
