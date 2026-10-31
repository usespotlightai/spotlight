import { MeterLabel } from '@/components/features/stations/config/MeterLabel';
import { costTick } from '@/lib/chart';
import {
  durationWords,
  type MonthSearch,
  SEARCH_WINDOW_DAYS,
  type SearchPolicy,
  searchMonth,
} from '@/lib/search-policy';

const WIDTH = 300;
const HEIGHT = 100;
const HEADROOM = 8;

type Scale = {
  x: (day: number) => number;
  y: (cost: number) => number;
};

const scaleTo = (top: number): Scale => ({
  x: (day) => (day / SEARCH_WINDOW_DAYS) * WIDTH,
  y: (cost) => HEIGHT - (cost / top) * (HEIGHT - HEADROOM),
});

const spentPath = (
  searches: readonly MonthSearch[],
  ceiling: number,
  { x, y }: Scale,
): string => {
  let total = 0;
  const steps = searches
    .filter((search) => search.fits)
    .map((search) => {
      total += ceiling;
      return `H${x(search.day)} V${y(total)}`;
    });

  return `M0 ${y(0)} ${steps.join(' ')} H${WIDTH}`;
};

const skippedPath = (
  searches: readonly MonthSearch[],
  ceiling: number,
  spent: number,
  { x, y }: Scale,
): string | null => {
  const skipped = searches.filter((search) => !search.fits);
  const first = skipped[0];

  if (!first) {
    return null;
  }

  const steps = skipped.map(
    (search, place) => `H${x(search.day)} V${y(spent + (place + 1) * ceiling)}`,
  );

  return `M${x(first.day)} ${y(spent)} ${steps.join(' ')} H${WIDTH}`;
};

export function SearchSchedule({ policy }: { policy: SearchPolicy }) {
  const month = searchMonth(policy);
  const search = costTick(policy.ceiling, policy.currency);
  const line = costTick(policy.monthlyCeiling, policy.currency);
  const every = durationWords(policy.period);

  if (!month) {
    return (
      <MeterLabel label={`Up to ${search} a search`} value={`Every ${every}`} />
    );
  }

  const top = Math.max(policy.monthlyCeiling, month.asked) || 1;
  const scale = scaleTo(top);
  const skipped = skippedPath(
    month.searches,
    policy.ceiling,
    month.spent,
    scale,
  );
  const spent = spentPath(month.searches, policy.ceiling, scale);
  const ceilingAt = (scale.y(policy.monthlyCeiling) / HEIGHT) * 100;
  const count = month.searches.length;

  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <MeterLabel
        label={`Up to ${search} each, every ${every}`}
        value={`${month.fitting} of ${count} fit`}
      />

      <div
        role="img"
        aria-label={`At most ${costTick(month.spent, policy.currency)} in ${SEARCH_WINDOW_DAYS} days. ${month.fitting} of ${count} scheduled searches fit the line's ${line} a month.`}
        data-slot="search-month"
        className="relative mt-3 min-h-20 flex-1"
      >
        <svg
          aria-hidden
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          <path
            d={`${spent} V${HEIGHT} H0 Z`}
            className="fill-chart-primary/10"
          />
          <line
            x1="0"
            x2={WIDTH}
            y1={scale.y(policy.monthlyCeiling)}
            y2={scale.y(policy.monthlyCeiling)}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            className="stroke-chart-axis"
          />
          {skipped && (
            <path
              d={skipped}
              fill="none"
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
              className="stroke-muted-foreground"
            />
          )}
          <path
            d={spent}
            fill="none"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            className="stroke-chart-primary"
          />
        </svg>

        <span
          className="absolute left-0 -translate-y-full pb-0.5 text-[0.65rem] text-muted-foreground"
          style={{ top: `${ceilingAt}%` }}
        >
          {line} line, each month
        </span>
      </div>

      <div className="flex justify-between text-[0.65rem] text-muted-foreground">
        <span>Day 1</span>
        <span>Day {SEARCH_WINDOW_DAYS}</span>
      </div>
    </div>
  );
}
