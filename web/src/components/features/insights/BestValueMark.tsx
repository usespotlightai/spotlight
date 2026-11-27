import { WithTooltip } from '@/components/shared/WithTooltip';

export const BEST_VALUE = 'Best for the cost';

export function BestValueMark() {
  return (
    <WithTooltip tooltip={BEST_VALUE}>
      <span className="inline-flex size-4 shrink-0 items-center justify-center">
        <span
          role="img"
          aria-label={BEST_VALUE}
          className="size-2 rounded-full bg-chart-primary"
        />
      </span>
    </WithTooltip>
  );
}
