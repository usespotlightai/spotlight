import type { ReactElement } from 'react';

import { ReplayedScatter } from '@/components/features/insights/candidates/ReplayedScatter';
import { type CandidatesSet, replayedPoints } from '@/lib/insights-candidates';

type ReplayedSetChartProps = {
  set: CandidatesSet;
};

export function ReplayedSetChart({ set }: ReplayedSetChartProps): ReactElement {
  const currency = set.chartCurrency;
  const points = replayedPoints(set);

  return (
    <>
      {points.length === 0 || currency === null || currency === '' ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          Nothing on this set has a priced score yet. Show the table to see the
          replays.
        </p>
      ) : (
        <ReplayedScatter points={points} currency={currency} />
      )}
    </>
  );
}
