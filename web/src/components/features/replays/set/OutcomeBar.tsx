import type { SetComposition } from '@/lib/replay';
import {
  formatRunOutcome,
  RUN_OUTCOME_LABEL,
  type RunOutcome,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const SWATCHES: Record<RunOutcome, string> = {
  accepted: 'bg-chart-success',
  'sent-back': 'bg-chart-3',
  asked: 'bg-chart-2',
  failed: 'bg-chart-1',
  other: 'bg-muted-foreground/30',
};

type OutcomeBarProps = {
  outcomes: SetComposition['outcomes'];
};

export function OutcomeBar({ outcomes }: OutcomeBarProps) {
  const total = outcomes.reduce((sum, each) => sum + each.count, 0);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        aria-hidden
        data-slot="outcome-bar"
        className="flex h-2 gap-px overflow-hidden rounded-full bg-muted"
      >
        {outcomes
          .filter((each) => each.count > 0)
          .map((each) => (
            <span
              key={each.outcome}
              className={cn('h-full', SWATCHES[each.outcome])}
              style={{ width: `${(each.count / total) * 100}%` }}
            />
          ))}
      </div>

      <ul
        aria-label={RUN_OUTCOME_LABEL}
        className="flex flex-wrap gap-x-3 gap-y-1 text-xs"
      >
        {outcomes
          .filter((each) => each.count > 0)
          .map((each) => (
            <li
              key={each.outcome}
              data-slot="outcome-count"
              className="flex items-center gap-1.5 text-muted-foreground"
            >
              <span
                aria-hidden
                className={cn('size-2 rounded-sm', SWATCHES[each.outcome])}
              />
              <span className="text-foreground">
                {formatRunOutcome(each.outcome)}
              </span>
              <span className="tabular-nums">{each.count}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
