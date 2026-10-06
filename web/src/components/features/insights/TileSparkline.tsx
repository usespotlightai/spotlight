import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

type TileSparklineProps = {
  label: string;
  values: readonly number[];
};

export function TileSparkline({ label, values }: TileSparklineProps) {
  return (
    <div
      role="img"
      aria-label={label}
      data-slot="tile-sparkline"
      className="h-8 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={values.map((value, at) => ({ at, value }))}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <YAxis hide domain={[0, 'dataMax']} />
          <Area
            dataKey="value"
            stroke="var(--chart-primary)"
            strokeWidth={1.5}
            fill="var(--chart-primary)"
            fillOpacity={0.08}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
