import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import type { ScoreCount } from '@/lib/judge';

export function ScoreDistribution({
  counts,
}: {
  counts: readonly ScoreCount[];
}) {
  return (
    <figure
      data-slot="score-distribution"
      className="flex flex-1 flex-col gap-1"
    >
      <ChartLegend
        entries={[
          { label: 'Judge', color: 'var(--chart-primary)' },
          { label: 'People', color: 'var(--chart-2)' },
        ]}
      />
      <div className="min-h-35 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[...counts]}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barGap={2}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
            />
            <Bar
              dataKey="judge"
              name="Judge"
              fill="var(--chart-primary)"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="people"
              name="People"
              fill="var(--chart-2)"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
