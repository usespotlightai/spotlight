import { Cell, Pie, PieChart } from 'recharts';
import { sliceFill } from '@/components/features/insights/chart-series';
import type { CostSlice } from '@/lib/insights';

export const DONUT_SIZE = 120;

export const DONUT_RING = 16;

export function CostDonut({ slices }: { slices: readonly CostSlice[] }) {
  return (
    <div aria-hidden data-slot="cost-donut" className="shrink-0">
      <PieChart width={DONUT_SIZE} height={DONUT_SIZE}>
        <Pie
          data={[...slices]}
          dataKey="amount"
          innerRadius={DONUT_SIZE / 2 - DONUT_RING}
          outerRadius={DONUT_SIZE / 2}
          startAngle={90}
          endAngle={-270}
          stroke="var(--card)"
          strokeWidth={1}
          isAnimationActive={false}
        >
          {slices.map((slice, at) => (
            <Cell key={slice.key ?? 'none'} fill={sliceFill(at)} />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
}
