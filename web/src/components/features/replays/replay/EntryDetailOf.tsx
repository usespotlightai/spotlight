import { EntryDetail } from '@/components/features/replays/replay/EntryDetail';
import { useLingering } from '@/hooks/useLingering';
import type { EntryComparison } from '@/lib/replay';

const LEAVING = 240;

type EntryDetailOfProps = {
  slug: string;
  teamId: string;
  chosen: EntryComparison | null;
  counterpartLabel: string;
  onClose: () => void;
};

export function EntryDetailOf({
  slug,
  teamId,
  chosen,
  counterpartLabel,
  onClose,
}: EntryDetailOfProps) {
  const lingering = useLingering(chosen, LEAVING);

  return lingering ? (
    <EntryDetail
      slug={slug}
      teamId={teamId}
      row={lingering}
      counterpartLabel={counterpartLabel}
      open={chosen !== null}
      onClose={onClose}
    />
  ) : null;
}
