import { Cell, Pie, PieChart } from 'recharts';
import { sliceFill } from '@/components/features/insights/chart-series';

export const DONUT_SIZE = 120;

export const DONUT_RING = 16;

type DonutSlice = {
  key: string;
  value: number;
};

type SliceDonutProps = {
  slices: readonly DonutSlice[];
  slot: string;
};

export function SliceDonut({ slices, slot }: SliceDonutProps) {
  return (
    <div aria-hidden data-slot={slot} className="shrink-0">
      <PieChart width={DONUT_SIZE} height={DONUT_SIZE}>
        <Pie
          data={[...slices]}
          dataKey="value"
          innerRadius={DONUT_SIZE / 2 - DONUT_RING}
          outerRadius={DONUT_SIZE / 2}
          startAngle={90}
          endAngle={-270}
          stroke="var(--card)"
          strokeWidth={1}
          isAnimationActive={false}
        >
          {slices.map((slice, at) => (
            <Cell key={slice.key} fill={sliceFill(at)} />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
}
