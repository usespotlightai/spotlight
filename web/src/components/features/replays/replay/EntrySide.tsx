import { Noted } from '@/components/shared/Noted';
import { RESULT_INK, type ReplayEntry, repeatsTally } from '@/lib/replay';
import {
  formatReason,
  formatRepeat,
  formatResult,
  NOT_SCORED_YET,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const reasonsOf = (entry: ReplayEntry): string =>
  entry.reasons.map(formatReason).join(' · ');

const repeatNote = (entry: ReplayEntry): string => {
  const reasons = reasonsOf(entry);

  return `${formatRepeat(entry.repeat)}: ${formatResult(entry.result)}${reasons ? ` (${reasons})` : ''}`;
};

export function EntrySide({ repeats }: { repeats: readonly ReplayEntry[] }) {
  const [only] = repeats;

  if (repeats.length === 1 && only) {
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

  const { succeeded, scored } = repeatsTally(repeats);

  return (
    <Noted note={repeats.map(repeatNote).join(' · ')}>
      <span
        data-slot="entry-side"
        className="relative z-10 font-medium text-foreground tabular-nums"
      >
        {scored === 0 ? NOT_SCORED_YET : `${succeeded} of ${scored} succeeded`}
      </span>
    </Noted>
  );
}
