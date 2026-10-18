import { TriangleAlert } from 'lucide-react';
import { Pill } from '@/components/shared/Pill';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatOverfit, type Overfit, overfitNote } from '@/lib/search-words';
import { cn } from '@/lib/utils';

type OverfitBadgeProps = {
  mark: Overfit;
  className?: string;
};

export function OverfitBadge({ mark, className }: OverfitBadgeProps) {
  return (
    <WithTooltip tooltip={overfitNote(mark)}>
      <span
        data-slot="only-on-seen-tasks"
        data-mark={mark}
        className={cn('inline-flex', className)}
      >
        {mark === 'likely' ? (
          <Pill
            lead={<TriangleAlert aria-hidden className="size-3" />}
            className={cn(
              'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
            )}
          >
            {formatOverfit(mark)}
          </Pill>
        ) : (
          <span className="text-muted-foreground text-xs">
            {formatOverfit(mark)}
          </span>
        )}
      </span>
    </WithTooltip>
  );
}
