import { InvalidHoldError } from '@work/domain/exceptions/invalid-hold.error';

export const HOLD_VERDICTS = ['not-right', 'exploring'] as const;

export type HoldVerdict = (typeof HOLD_VERDICTS)[number];

export const UNSAID_HOLD_VERDICT: HoldVerdict = 'not-right';

export const holdVerdictOf = (raw: string): HoldVerdict => {
  const found = HOLD_VERDICTS.find((each) => each === raw);

  if (!found) {
    throw new InvalidHoldError(`has no verdict ${JSON.stringify(raw)}`);
  }

  return found;
};
