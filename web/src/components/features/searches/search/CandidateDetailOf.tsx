import { CandidateDetail } from '@/components/features/searches/search/CandidateDetail';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import type { ReplayedStation } from '@/lib/replay';
import type { SearchCandidate } from '@/lib/search';

const LEAVING = 240;

type CandidateDetailOfProps = {
  at: ReplayedStation;
  searchId: string;
  chosen: SearchCandidate | null;
  live: SearchCandidate;
  currency: string;
  maxRegressions: number | null;
  onClose: () => void;
};

export function CandidateDetailOf({
  at,
  searchId,
  chosen,
  live,
  currency,
  maxRegressions,
  onClose,
}: CandidateDetailOfProps) {
  const displayed = useDelayedValue(chosen, LEAVING);

  return displayed ? (
    <CandidateDetail
      at={at}
      searchId={searchId}
      candidate={displayed}
      live={live}
      currency={currency}
      maxRegressions={maxRegressions}
      open={chosen !== null}
      onClose={onClose}
    />
  ) : null;
}
