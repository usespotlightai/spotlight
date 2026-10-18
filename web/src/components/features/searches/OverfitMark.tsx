import { WarningTooltip } from '@/components/shared/WarningTooltip';
import { formatOverfit, type Overfit, overfitNote } from '@/lib/search-words';

export function OverfitMark({ mark }: { mark: Overfit }) {
  return (
    <WarningTooltip
      data-slot="only-on-seen-tasks"
      data-mark={mark}
      tone={mark === 'likely' ? 'warning' : 'muted'}
      label={formatOverfit(mark)}
      tooltip={overfitNote(mark)}
      className="relative z-10"
    />
  );
}
