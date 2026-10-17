import { Noted } from '@/components/shared/Noted';
import { copiesTally, RESULT_INK, type ReplayEntry } from '@/lib/replay';
import {
  formatCopy,
  formatReason,
  formatResult,
  NOT_SCORED_YET,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const reasonsOf = (entry: ReplayEntry): string =>
  entry.reasons.map(formatReason).join(' · ');

const copyNote = (entry: ReplayEntry): string => {
  const reasons = reasonsOf(entry);

  return `${formatCopy(entry.repeat)}: ${formatResult(entry.result)}${reasons ? ` (${reasons})` : ''}`;
};

export function EntrySide({ copies }: { copies: readonly ReplayEntry[] }) {
  const [only] = copies;

  if (copies.length === 1 && only) {
    const reasons = reasonsOf(only);
    const word = (
      <span
        data-slot="entry-side"
        className={cn('relative z-10 font-medium', RESULT_INK[only.result])}
      >
        {formatResult(only.result)}
      </span>
    );

    return reasons ? <Noted note={reasons}>{word}</Noted> : word;
  }

  const { succeeded, scored } = copiesTally(copies);

  return (
    <Noted note={copies.map(copyNote).join(' · ')}>
      <span
        data-slot="entry-side"
        className="relative z-10 font-medium text-foreground tabular-nums"
      >
        {scored === 0 ? NOT_SCORED_YET : `${succeeded} of ${scored} succeeded`}
      </span>
    </Noted>
  );
}
