import { Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts';

import { WAIT_SERIES } from '@/components/features/insights/chart-series';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { StationWaitsTable } from '@/components/features/insights/StationWaitsTable';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { ResponsiveChart } from '@/components/shared/chart/ResponsiveChart';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import {
  formatDuration,
  type StationFlow,
  type StationNames,
  WAITS_NOTE,
  type WaitRow,
  waitRows,
} from '@/lib/insights';

export const WAIT_ROW_HEIGHT = 28;

const TipContent = ({
  placement,
  active,
  payload,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: WaitRow }[];
}) => {
  const row = payload?.[0]?.payload;

  if (!active || !row) {
    return null;
  }

  return (
    <ChartTip
      placement={placement}
      note={{
        title: `${row.label}, median`,
        rows: WAIT_SERIES.map((wait): [string, string] => [
          wait.label,
          formatDuration(row[wait.key]),
        ]),
      }}
    />
  );
};

type StationWaitsProps = {
  slug: string;
  teamId: string;
  stations: readonly StationFlow[];
  names: StationNames;
};

export function StationWaits({
  slug,
  teamId,
  stations,
  names,
}: StationWaitsProps) {
  const cursor = useCursorTooltip();
  const rows = waitRows(stations, names);

  return (
    <InsightsCard
      flat
      title="Where tasks wait"
      description={WAITS_NOTE}
      table={
        <StationWaitsTable
          slug={slug}
          teamId={teamId}
          stations={stations}
          names={names}
        />
      }
    >
      <figure data-slot="waits-chart" className="flex flex-col gap-1">
        <figcaption className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
          {WAIT_SERIES.map((wait) => (
            <span key={wait.key} className="flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-sm"
                style={{ background: wait.fill }}
              />
              {wait.label}
            </span>
          ))}
        </figcaption>

        <div className="[&_*:focus:not(:focus-visible)]:outline-none">
          <div {...cursor.area}>
            <ResponsiveChart height={rows.length * WAIT_ROW_HEIGHT + 16}>
              <BarChart
                data={rows}
                layout="vertical"
                barSize={12}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={112}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                />
                <Tooltip
                  {...cursor.tooltip}
                  content={<TipContent placement={cursor.placement} />}
                  cursor={{ fill: 'var(--accent)' }}
                />
                {WAIT_SERIES.map((wait) => (
                  <Bar
                    key={wait.key}
                    dataKey={wait.key}
                    name={wait.label}
                    stackId="wait"
                    fill={wait.fill}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveChart>
          </div>
        </div>
      </figure>
    </InsightsCard>
  );
}
