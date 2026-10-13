import { CandidateDetail } from '@/components/features/searches/search/CandidateDetail';
import { useLingering } from '@/hooks/useLingering';
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
  const held = useLingering(chosen, LEAVING);

  return held ? (
    <CandidateDetail
      at={at}
      searchId={searchId}
      candidate={held}
      currency={currency}
      open={chosen !== null}
      onClose={onClose}
    />
  ) : null;
}
