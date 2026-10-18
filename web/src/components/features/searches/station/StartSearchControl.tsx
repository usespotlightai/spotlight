import { StartSearchButton } from '@/components/features/searches/station/StartSearchButton';
import { useSearchStart } from '@/hooks/useSearchStart';
import type { ReplayedStation } from '@/lib/replay';

export function StartSearchControl({ at }: { at: ReplayedStation }) {
  const { searches, sets, replaySets, problem } = useSearchStart(at);
  const nothingToSearch =
    (searches.data ?? []).length === 0 && sets.data?.length === 0;

  if (nothingToSearch) {
    return null;
  }

  return (
    <StartSearchButton at={at} sets={replaySets} disabledBecause={problem} />
  );
}
