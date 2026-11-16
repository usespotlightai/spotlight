import { InvalidHoldError } from '@work/domain/exceptions/invalid-hold.error';

export const HOLD_ENDS = ['continue', 'move-on', 'finish'] as const;

export type HoldEnd = (typeof HOLD_ENDS)[number];

export const holdEndOf = (raw: string): HoldEnd => {
  const found = HOLD_ENDS.find((each) => each === raw);

  if (!found) {
    throw new InvalidHoldError(`has no resume ${JSON.stringify(raw)}`);
  }

  return found;
};
