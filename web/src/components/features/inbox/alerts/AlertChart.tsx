import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dayShown } from '@/lib/judge';
import {
  type AlertPoint,
  measureValueShown,
  type StationAlertCrossing,
  thresholdLine,
} from '@/lib/station-alert';

const HEIGHT = 160;

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

  return (
    <figure data-slot="alert-chart" className="flex flex-col gap-1">
      <figcaption className="text-muted-foreground text-xs">
        Run by run, over the last {alert.threshold.over}{' '}
        {alert.threshold.over === 1 ? 'run' : 'runs'} each time
      </figcaption>
      <div className="[&_*:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <LineChart
            data={[...alert.series]}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <XAxis dataKey="runId" hide />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--faint)', fontSize: 10 }}
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
    </figure>
  );
}
