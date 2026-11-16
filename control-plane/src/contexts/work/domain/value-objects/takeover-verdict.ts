import { InvalidTakeoverError } from '@work/domain/exceptions/invalid-takeover.error';

export const TAKEOVER_VERDICTS = ['not-right', 'exploring'] as const;

export type TakeoverVerdict = (typeof TAKEOVER_VERDICTS)[number];

export const UNSAID_TAKEOVER_VERDICT: TakeoverVerdict = 'not-right';

export const takeoverVerdictOf = (raw: string): TakeoverVerdict => {
  const found = TAKEOVER_VERDICTS.find((each) => each === raw);

  if (!found) {
    throw new InvalidTakeoverError(`has no verdict ${JSON.stringify(raw)}`);
  }

  return found;
};
