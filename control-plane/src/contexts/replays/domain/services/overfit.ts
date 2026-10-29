import {
  type GainEstimate,
  MIN_PAIRED_TASKS,
} from '@replays/domain/services/gain-estimate';

const OVERFIT_STATUSES = ['likely', 'too-few-held-out'] as const;

export type Overfit = (typeof OVERFIT_STATUSES)[number];

export const overfitOf = (
  searchedGain: GainEstimate | null,
  heldOutGain: GainEstimate | null,
): Overfit | null => {
  if (searchedGain?.significance !== 'better' || heldOutGain === null) {
    return null;
  }
  if (heldOutGain.tasks < MIN_PAIRED_TASKS) {
    return 'too-few-held-out';
  }

  return heldOutGain.significance === 'better' ? null : 'likely';
};
