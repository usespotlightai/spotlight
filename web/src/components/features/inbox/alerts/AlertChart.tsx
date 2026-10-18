import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertChartLegend } from '@/components/features/inbox/alerts/AlertChartLegend';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { formatDay } from '@/lib/judge';
import {
  type AlertPoint,
  formatFiring,
  formatMeasureValue,
  formatRule,
  type StationAlertFiring,
  thresholdLine,
} from '@/lib/station-alert';

export const ALERT_CHART_HEIGHT = 160;

const TICK_CHARACTER_WIDTH = 6;

const TICKS_GAP = 8;

const ticksWidth = (alert: StationAlertFiring): number => {
  const values = [
    ...alert.series.map((point) => point.value ?? 0),
    thresholdLine(alert) ?? 0,
    alert.baseline ?? 0,
  ];
  const widest = Math.max(
    ...values.map(
      (value) =>
        formatMeasureValue(alert.rule.measure, value, alert.currency).length,
    ),
  );

  return widest * TICK_CHARACTER_WIDTH + TICKS_GAP;
};

const TipContent = ({
  placement,
  active,
  payload,
  alert,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: AlertPoint }[];
  alert: StationAlertFiring;
}) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">
        Run ended {formatDay(point.endedAt.slice(0, 10))}
      </p>
      <p className="text-foreground">
        {formatMeasureValue(alert.rule.measure, point.value, alert.currency)}
        {point.runId === alert.runId ? ' · fired here' : ''}
      </p>
    </ChartTip>
  );
};

export function AlertChart({ alert }: { alert: StationAlertFiring }) {
  const cursor = useCursorTooltip();
  const level = thresholdLine(alert);
  const width = ticksWidth(alert);

  return (
    <figure data-slot="alert-chart" className="flex flex-col gap-2">
      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <div {...cursor.area}>
          <ResponsiveContainer width="100%" height={ALERT_CHART_HEIGHT}>
            <LineChart
              data={[...alert.series]}
              title={formatRule(alert)}
              desc={formatFiring(alert)}
              margin={{ top: 8, right: 0, bottom: 8, left: 0 }}
            >
              <XAxis dataKey="runId" hide />
              <YAxis
                width={width}
                tickMargin={0}
                tickSize={0}
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: 'var(--chart-axis)',
                  fontSize: 10,
                  textAnchor: 'start',
                  dx: -width,
                  style: { fontVariantNumeric: 'tabular-nums' },
                }}
                tickFormatter={(value: number) =>
                  formatMeasureValue(alert.rule.measure, value, alert.currency)
                }
              />
              <Tooltip
                {...cursor.tooltip}
                content={
                  <TipContent placement={cursor.placement} alert={alert} />
                }
                cursor={{ stroke: 'var(--chart-grid)' }}
              />
              {level !== null && (
                <ReferenceLine
                  y={level}
                  stroke="var(--destructive)"
                  strokeDasharray="4 3"
                />
              )}
              {alert.baseline !== null && (
                <ReferenceLine
                  y={alert.baseline}
                  stroke="var(--chart-axis)"
                  strokeDasharray="3 3"
                />
              )}
              <ReferenceLine
                x={alert.runId}
                stroke="var(--destructive)"
                strokeOpacity={0.4}
              />
              <Line
                dataKey="value"
                stroke="var(--chart-primary)"
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <AlertChartLegend alert={alert} />
    </figure>
  );
}
