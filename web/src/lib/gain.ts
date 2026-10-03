import type { GainReading } from '@/lib/replay';
import { type PairTally, pairsJudged } from '@/lib/replay-words';

export const gainJudged = (
  gain: GainReading | null,
  pairs: PairTally | null,
): boolean => gain !== null || pairsJudged(pairs);
