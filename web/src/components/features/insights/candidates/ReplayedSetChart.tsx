import { ReplayedScatter } from '@/components/features/insights/candidates/ReplayedScatter';
import { type CandidatesSet, replayedPoints } from '@/lib/insights-candidates';

type ReplayedSetChartProps = {
  set: CandidatesSet;
};

export function ReplayedSetChart({ set }: ReplayedSetChartProps) {
  const currency = set.chartCurrency;
  const points = replayedPoints(set);

  return (
    <>
      {points.length === 0 || !currency ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          Nothing on this set has a priced score yet. Show the table to see
          what’s there.
        </p>
      ) : (
        <ReplayedScatter points={points} currency={currency} />
      )}
    </>
  );
}
