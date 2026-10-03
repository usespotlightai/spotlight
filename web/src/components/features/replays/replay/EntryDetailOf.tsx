import { EntryDetail } from '@/components/features/replays/replay/EntryDetail';
import { useLingering } from '@/hooks/useLingering';
import type { EntryComparison } from '@/lib/replay';

const LEAVING = 240;

type EntryDetailOfProps = {
  slug: string;
  teamId: string;
  chosen: EntryComparison | null;
  onClose: () => void;
};

export function EntryDetailOf({
  slug,
  teamId,
  chosen,
  onClose,
}: EntryDetailOfProps) {
  const held = useLingering(chosen, LEAVING);

  return held ? (
    <EntryDetail
      slug={slug}
      teamId={teamId}
      row={held}
      open={chosen !== null}
      onClose={onClose}
    />
  ) : null;
}
