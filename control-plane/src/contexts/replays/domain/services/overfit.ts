import {
  type GainReading,
  MIN_PAIRED_TASKS,
} from '@replays/domain/services/gain-reading';

export const ONLY_ON_SEEN_TASKS = ['marked', 'too-few-held-out'] as const;

export type OnlyOnSeenTasks = (typeof ONLY_ON_SEEN_TASKS)[number];

export const overfitOf = (
  searchedGain: GainReading | null,
  heldOutGain: GainReading | null,
): OnlyOnSeenTasks | null => {
  if (searchedGain?.verdict !== 'better' || heldOutGain === null) {
    return null;
  }
  if (heldOutGain.tasks < MIN_PAIRED_TASKS) {
    return 'too-few-held-out';
  }

  return heldOutGain.verdict === 'better' ? null : 'marked';
};
