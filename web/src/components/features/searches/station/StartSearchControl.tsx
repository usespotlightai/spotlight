import { StartSearchButton } from '@/components/features/searches/station/StartSearchButton';
import { useSearchStart } from '@/hooks/useSearchStart';
import type { ReplayedStation } from '@/lib/replay';

export function StartSearchControl({ at }: { at: ReplayedStation }) {
  const { searches, sets, held, refusal } = useSearchStart(at);
  const noSets = (searches.data ?? []).length === 0 && sets.data?.length === 0;

  if (noSets) {
    return null;
  }

  return <StartSearchButton at={at} sets={held} refusedBecause={refusal} />;
}
