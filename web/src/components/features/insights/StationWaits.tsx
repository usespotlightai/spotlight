import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { StationWaitsTable } from '@/components/features/insights/StationWaitsTable';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import {
  lasted,
  type StationFlow,
  type StationNames,
  type WaitRow,
  waitRows,
} from '@/lib/insights';

const ROW_HEIGHT = 32;

const WAITS = [
  { key: 'queued', label: 'Queued', fill: 'var(--chart-3)' },
  { key: 'running', label: 'Running', fill: 'var(--chart-primary)' },
  { key: 'inbox', label: 'In the inbox', fill: 'var(--chart-5)' },
] as const;

const Said = ({
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
    <ChartTip placement={placement}>
      <p className="text-foreground">{row.label}, typically</p>
      {WAITS.map((wait) => (
        <p key={wait.key} className="text-muted-foreground">
          {wait.label} {lasted(row[wait.key])}
        </p>
      ))}
    </ChartTip>
  );
};

type StationWaitsProps = {
  slug: string;
  teamId: string;
  stations: readonly StationFlow[];
  before: readonly StationFlow[];
  names: StationNames;
};

export function StationWaits({
  slug,
  teamId,
  stations,
  before,
  names,
}: StationWaitsProps) {
  const cursor = useCursorTooltip();
  const rows = waitRows(stations, names);

  return (
    <InsightsCard
      title="Where tasks wait"
      description="Median time per station: queued, running, in the inbox. Stations in the order they first ran."
      table={
        <StationWaitsTable
          slug={slug}
          teamId={teamId}
          stations={stations}
          before={before}
          names={names}
        />
      }
    >
      <figure data-slot="waits-chart" className="flex flex-col gap-1">
        <figcaption className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
          {WAITS.map((wait) => (
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
            <ResponsiveContainer
              width="100%"
              height={rows.length * ROW_HEIGHT + 16}
            >
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={112}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                />
                <Tooltip
                  {...cursor.tooltip}
                  content={<Said placement={cursor.placement} />}
                  cursor={{ fill: 'var(--accent)' }}
                />
                {WAITS.map((wait) => (
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
            </ResponsiveContainer>
          </div>
        </div>
      </figure>
    </InsightsCard>
  );
}
