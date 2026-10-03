import { BalanceWarning } from '@/components/features/replays/set/BalanceWarning';
import { OutcomeBar } from '@/components/features/replays/set/OutcomeBar';
import type { SetComposition } from '@/lib/replay';
import {
  COMPOSITION_LABEL,
  endedSpanShown,
  ORIGINS_LABEL,
  originShown,
} from '@/lib/replay-words';

type SetCompositionBoxProps = {
  composition: SetComposition;
};

export function SetCompositionBox({ composition }: SetCompositionBoxProps) {
  const span = endedSpanShown(composition);

  return (
    <section
      aria-label={COMPOSITION_LABEL}
      data-slot="set-composition"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium text-foreground text-xs">
          {COMPOSITION_LABEL}
        </span>
        {span && <span className="text-muted-foreground text-xs">{span}</span>}
      </div>

      <OutcomeBar outcomes={composition.outcomes} />

      <div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs">
        <span>{ORIGINS_LABEL}:</span>
        <ul aria-label={ORIGINS_LABEL} className="flex flex-wrap gap-x-1.5">
          {composition.origins.map((each, place) => (
            <li key={each.origin} className="tabular-nums">
              {place > 0 && '· '}
              <span className="text-foreground">
                {originShown(each.origin)}
              </span>{' '}
              {each.count}
            </li>
          ))}
        </ul>
      </div>

      {composition.balanceWarning && (
        <BalanceWarning warning={composition.balanceWarning} />
      )}
    </section>
  );
}
