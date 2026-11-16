import { InvalidTakeoverError } from '@work/domain/exceptions/invalid-takeover.error';

export const HAND_BACKS = ['continue', 'move-on', 'finish'] as const;

export type HandBack = (typeof HAND_BACKS)[number];

export const handBackOf = (raw: string): HandBack => {
  const found = HAND_BACKS.find((each) => each === raw);

  if (!found) {
    throw new InvalidTakeoverError(`has no hand-back ${JSON.stringify(raw)}`);
  }

  return found;
};
