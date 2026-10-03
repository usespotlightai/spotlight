import type { SetNoise } from '@replays/domain/services/set-noise';
import { MOST_REPEATS } from '@replays/domain/value-objects/replay-repeats';

const ROUNDING = 1e-9;

export type SearchWarning =
  | { readonly kind: 'noise-unmeasured' }
  | {
      readonly kind: 'noisy';
      readonly spread: number;
      readonly minGain: number;
      readonly neededRepeats: number;
      readonly suggestedRepeats: number;
    };

const neededRepeatsFor = (spread: number, minGain: number): number =>
  Math.max(1, Math.ceil((spread / minGain) ** 2 - ROUNDING));

export const suggestedRepeatsFor = (spread: number, minGain: number): number =>
  Math.min(MOST_REPEATS, neededRepeatsFor(spread, minGain));

export const searchWarningsOf = (
  noise: SetNoise | null,
  minGain: number,
  repeats: number,
): readonly SearchWarning[] => {
  if (!noise) {
    return [{ kind: 'noise-unmeasured' }];
  }

  const neededRepeats = neededRepeatsFor(noise.spread, minGain);

  return neededRepeats > repeats
    ? [
        {
          kind: 'noisy',
          spread: noise.spread,
          minGain,
          neededRepeats,
          suggestedRepeats: suggestedRepeatsFor(noise.spread, minGain),
        },
      ]
    : [];
};
