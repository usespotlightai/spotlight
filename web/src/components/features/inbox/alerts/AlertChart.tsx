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
import { dayShown } from '@/lib/judge';
import {
  type AlertPoint,
  crossingShown,
  measureValueShown,
  type StationAlertCrossing,
  thresholdLine,
  thresholdShown,
} from '@/lib/station-alert';

export const ALERT_CHART_HEIGHT = 160;

const TICK_CHARACTER_WIDTH = 6;

const TICKS_GAP = 8;

const ticksWidth = (alert: StationAlertCrossing): number => {
  const values = [
    ...alert.series.map((point) => point.value ?? 0),
    thresholdLine(alert) ?? 0,
    alert.baseline ?? 0,
  ];
  const widest = Math.max(
    ...values.map(
      (value) =>
        measureValueShown(alert.threshold.measure, value, alert.currency)
          .length,
    ),
  );

  return widest * TICK_CHARACTER_WIDTH + TICKS_GAP;
};

const Said = ({
  active,
  payload,
  alert,
}: {
  active?: boolean;
  payload?: { payload: AlertPoint }[];
  alert: StationAlertCrossing;
}) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-overlay">
      <p className="text-muted-foreground">
        Run ended {dayShown(point.endedAt.slice(0, 10))}
      </p>
      <p className="text-foreground">
        {measureValueShown(
          alert.threshold.measure,
          point.value,
          alert.currency,
        )}
        {point.runId === alert.runId ? ' · crossed here' : ''}
      </p>
    </div>
  );
};

export function AlertChart({ alert }: { alert: StationAlertCrossing }) {
  const level = thresholdLine(alert);
  const width = ticksWidth(alert);

  return (
    <figure data-slot="alert-chart" className="flex flex-col gap-2">
      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height={ALERT_CHART_HEIGHT}>
          <LineChart
            data={[...alert.series]}
            title={thresholdShown(alert)}
            desc={crossingShown(alert)}
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
                fill: 'var(--faint)',
                fontSize: 10,
                textAnchor: 'start',
                dx: -width,
                style: { fontVariantNumeric: 'tabular-nums' },
              }}
              tickFormatter={(value: number) =>
                measureValueShown(
                  alert.threshold.measure,
                  value,
                  alert.currency,
                )
              }
            />
            <Tooltip
              content={<Said alert={alert} />}
              isAnimationActive={false}
              cursor={{ stroke: 'var(--border)' }}
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
                stroke="var(--faint)"
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
              stroke="var(--primary)"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <AlertChartLegend alert={alert} />
    </figure>
  );
}
