import { GainValue } from '@/components/features/insights/candidates/GainValue';
import type { GainEstimate } from '@/lib/replay';
import { formatGainNote, NO_VALUE } from '@/lib/search-words';

type ResultGainProps = {
  gain: GainEstimate | null;
};

export function ResultGain({ gain }: ResultGainProps) {
  if (!gain) {
    return <span className="text-muted-foreground">{NO_VALUE}</span>;
  }

  return <GainValue gain={gain} tooltip={formatGainNote(gain)} />;
}
