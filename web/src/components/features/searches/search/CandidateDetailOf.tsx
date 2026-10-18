import { CandidateDetail } from '@/components/features/searches/search/CandidateDetail';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import type { ReplayedStation } from '@/lib/replay';
import type { SearchCandidate } from '@/lib/search';

const LEAVING = 240;

type CandidateDetailOfProps = {
  at: ReplayedStation;
  searchId: string;
  chosen: SearchCandidate | null;
  currency: string;
  onClose: () => void;
};

export function CandidateDetailOf({
  at,
  searchId,
  chosen,
  currency,
  onClose,
}: CandidateDetailOfProps) {
  const displayed = useDelayedValue(chosen, LEAVING);

  return displayed ? (
    <CandidateDetail
      at={at}
      searchId={searchId}
      candidate={displayed}
      currency={currency}
      open={chosen !== null}
      onClose={onClose}
    />
  ) : null;
}
