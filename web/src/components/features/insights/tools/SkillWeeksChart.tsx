import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import type { SkillWeek } from '@/lib/insights-tools';
import { dayShown } from '@/lib/judge';

const HEIGHT = 16;

type ReadWeek = SkillWeek & { readonly share: number };

const Said = ({
  placement,
  active,
  payload,
}: {
  placement: TipPlacement;
  active?: boolean;
  payload?: { payload: ReadWeek }[];
}) => {
  const week = payload?.[0]?.payload;

  if (!active || !week) {
    return null;
  }

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">Week of {dayShown(week.week)}</p>
      <p className="text-foreground">
        Read in {week.used} of {week.runs} {week.runs === 1 ? 'run' : 'runs'}
      </p>
      <p className="text-muted-foreground">Given to {week.given}</p>
    </ChartTip>
  );
};

type SkillWeeksChartProps = {
  weeks: readonly SkillWeek[];
  onWeek: (week: string) => void;
};

export function SkillWeeksChart({ weeks, onWeek }: SkillWeeksChartProps) {
  const cursor = useCursorTooltip({ floating: true });
  const read: ReadWeek[] = weeks.map((week) => ({
    ...week,
    share: week.runs > 0 ? week.used / week.runs : 0,
  }));

  return (
    <div
      data-slot="skill-weeks-chart"
      className="[&_*:focus:not(:focus-visible)]:outline-none"
    >
      <div {...cursor.area}>
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <LineChart
            data={read}
            margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
            className="cursor-pointer"
            onClick={(state) => {
              const week = weeks[Number(state.activeIndex)];
              if (week) {
                onWeek(week.week);
              }
            }}
          >
            <YAxis hide domain={[0, 'dataMax']} />
            <Tooltip
              {...cursor.tooltip}
              content={<Said placement={cursor.placement} />}
              cursor={{ stroke: 'var(--chart-grid)' }}
            />
            <Line
              dataKey="share"
              stroke="var(--chart-primary)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
