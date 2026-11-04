import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

const TONES = {
  primary: 'var(--chart-primary)',
  muted: 'var(--muted-foreground)',
  done: 'var(--outcome-done)',
} as const;

type TileSparklineProps = {
  label: string;
  values: readonly (number | null)[];
  tone?: keyof typeof TONES;
};

export function TileSparkline({
  label,
  values,
  tone = 'primary',
}: TileSparklineProps) {
  const ink = TONES[tone];

  return (
    <div
      role="img"
      aria-label={label}
      data-slot="tile-sparkline"
      className="h-6 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={values.map((value, at) => ({ at, value }))}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <YAxis hide domain={[0, 'dataMax']} />
          <Area
            dataKey="value"
            stroke={ink}
            strokeWidth={1.5}
            fill={ink}
            fillOpacity={0.08}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
