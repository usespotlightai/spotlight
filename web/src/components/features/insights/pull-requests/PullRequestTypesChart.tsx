import { AUTHOR_SERIES } from '@/components/features/insights/chart-series';
import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatSpend } from '@/lib/insights';
import { formatType, type TypeShare } from '@/lib/insights-pull-requests';

const widthOf = (count: number, most: number): string =>
  most === 0 ? '0%' : `${(count / most) * 100}%`;

export function PullRequestTypesChart({
  types,
}: {
  types: readonly TypeShare[];
}) {
  const most = Math.max(
    0,
    ...types.flatMap((each) => [each.spotlight, each.people]),
  );

  return (
    <figure data-slot="types-chart" className="flex flex-col gap-3">
      <ul
        aria-label="Merged pull requests by type"
        className="flex flex-col gap-2"
      >
        {types.map((each) => (
          <li key={each.type}>
            <WithTooltip
              tooltip={{
                title: formatType(each.type),
                rows: [
                  ['By Spotlight', `${each.spotlight}`],
                  ['By people alone', `${each.people}`],
                  ['Spotlight spent', formatSpend(each.spend)],
                ],
              }}
            >
              <div className="flex cursor-default flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-foreground">
                    {formatType(each.type)}
                  </span>
                  <span className="flex items-baseline gap-3 tabular-nums">
                    <span className="text-foreground">{each.spotlight}</span>
                    <span className="w-8 text-right text-muted-foreground">
                      {each.people}
                    </span>
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="h-1.5 rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-chart-primary"
                      style={{ width: widthOf(each.spotlight, most) }}
                    />
                  </span>
                  <span className="h-1 rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-chart-2"
                      style={{ width: widthOf(each.people, most) }}
                    />
                  </span>
                </div>
              </div>
            </WithTooltip>
          </li>
        ))}
      </ul>

      <ChartLegend entries={AUTHOR_SERIES} />
    </figure>
  );
}
