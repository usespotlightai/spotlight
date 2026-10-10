import { Noted } from '@/components/shared/Noted';
import type { SearchBestResponseDto } from '@/lib/api';
import { percentShown } from '@/lib/judge';
import { bestScoreOf } from '@/lib/search';
import { bestScoreNote } from '@/lib/search-words';

export function SearchBestScore({
  best,
}: {
  best: SearchBestResponseDto | null;
}) {
  if (!best) {
    return <span className="text-muted-foreground">–</span>;
  }

  const { rate, interval, heldOut } = bestScoreOf(best);

  return (
    <Noted note={bestScoreNote(heldOut, interval)}>
      <span className="relative z-10 text-foreground tabular-nums">
        {percentShown(rate)}
      </span>
    </Noted>
  );
}
