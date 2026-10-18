import { EntryDetail } from '@/components/features/replays/replay/EntryDetail';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import type { EntryComparison } from '@/lib/replay';

const LEAVING = 240;

type EntryDetailOfProps = {
  slug: string;
  teamId: string;
  chosen: EntryComparison | null;
  referenceLabel: string;
  onClose: () => void;
};

export function EntryDetailOf({
  slug,
  teamId,
  chosen,
  referenceLabel,
  onClose,
}: EntryDetailOfProps) {
  const displayed = useDelayedValue(chosen, LEAVING);

  return displayed ? (
    <EntryDetail
      slug={slug}
      teamId={teamId}
      row={displayed}
      referenceLabel={referenceLabel}
      open={chosen !== null}
      onClose={onClose}
    />
  ) : null;
}
