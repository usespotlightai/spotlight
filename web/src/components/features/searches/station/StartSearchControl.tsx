import { StartSearchButton } from '@/components/features/searches/station/StartSearchButton';
import { useSearchStart } from '@/hooks/useSearchStart';
import type { ReplayedStation } from '@/lib/replay';

export function StartSearchControl({ at }: { at: ReplayedStation }) {
  const { searches, kept, problem } = useSearchStart(at);
  const nothingToSearch =
    (searches.data ?? []).length === 0 && kept.data === null;

  if (nothingToSearch) {
    return null;
  }

  return (
    <StartSearchButton
      at={at}
      set={kept.data ?? null}
      disabledBecause={problem}
    />
  );
}
