import { NotedWarning } from '@/components/shared/NotedWarning';
import { formatOverfit, type Overfit, overfitNote } from '@/lib/search-words';

export function OverfitMark({ mark }: { mark: Overfit }) {
  return (
    <NotedWarning
      data-slot="only-on-seen-tasks"
      data-mark={mark}
      tone={mark === 'likely' ? 'warning' : 'muted'}
      label={formatOverfit(mark)}
      note={overfitNote(mark)}
      className="relative z-10"
    />
  );
}
