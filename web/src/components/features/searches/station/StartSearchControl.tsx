import { StartSearchButton } from '@/components/features/searches/station/StartSearchButton';
import { buttonVariants } from '@/components/ui/button-variants';
import { useSearchStart } from '@/hooks/useSearchStart';
import { REPLAYS_ANCHOR, type ReplayedStation } from '@/lib/replay';
import { cn } from '@/lib/utils';

export function StartSearchControl({ at }: { at: ReplayedStation }) {
  const { searches, sets, held, refusal } = useSearchStart(at);
  const noSets = (searches.data ?? []).length === 0 && sets.data?.length === 0;

  return noSets ? (
    <a
      href={`#${REPLAYS_ANCHOR}`}
      className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
    >
      Create a replay set first
    </a>
  ) : (
    <StartSearchButton at={at} sets={held} refusedBecause={refusal} />
  );
}
