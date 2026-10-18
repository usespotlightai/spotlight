import type { GainEstimate } from '@/lib/replay';
import { type PairTally, pairsJudged } from '@/lib/replay-words';

export const gainJudged = (
  gain: GainEstimate | null,
  pairs: PairTally | null,
): boolean => gain !== null || pairsJudged(pairs);
