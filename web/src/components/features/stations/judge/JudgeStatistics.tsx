import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { MeterBar } from '@/components/features/stations/judge/MeterBar';
import type { ComparisonStat, PairsStat } from '@/lib/judge';

type JudgeStatisticsProps = {
  pairs: PairsStat;
  stats: readonly ComparisonStat[];
  minAgreement: number | null;
};

export function JudgeStatistics({
  pairs,
  stats,
  minAgreement,
}: JudgeStatisticsProps) {
  const leads = stats.length % 2 === 0;

  return (
    <div data-slot="judge-statistics">
      <InsightsTiles
        label="Agreement with people"
        className={stats.length === 0 ? 'grid-cols-1 @xl/pane:grid-cols-1' : ''}
      >
        <InsightsTile
          className={leads ? '@max-xl/pane:col-span-2' : undefined}
          label={pairs.label}
          value={pairs.value}
          detail={pairs.detail}
          tooltip={pairs.note}
          visual={
            pairs.progress !== null && <MeterBar share={pairs.progress} />
          }
        />
        {stats.map((stat) => (
          <InsightsTile
            key={stat.label}
            className={leads ? '@max-xl/pane:odd:last:col-span-1' : undefined}
            label={stat.label}
            value={stat.value}
            detail={stat.detail}
            tooltip={stat.note}
            visual={
              typeof stat.gauge === 'number' && (
                <MeterBar
                  share={stat.gauge}
                  marker={minAgreement}
                  failing={stat.failing}
                />
              )
            }
          />
        ))}
      </InsightsTiles>
    </div>
  );
}
