import type { SetHealth } from '@replays/domain/services/set-health';
import {
  isNoisyAt,
  neededRepeatsFor,
  suggestedRepeatsFor,
} from '@replays/domain/services/set-noise';

export type SearchWarning =
  | { readonly kind: 'noise-unmeasured' }
  | {
      readonly kind: 'noisy';
      readonly spread: number;
      readonly minGain: number;
      readonly neededRepeats: number;
      readonly suggestedRepeats: number;
    }
  | { readonly kind: 'saturated'; readonly rate: number }
  | {
      readonly kind: 'judge-unstable';
      readonly agreement: number;
      readonly compared: number;
    }
  | {
      readonly kind: 'flaky-checks';
      readonly flaky: number;
      readonly rechecked: number;
    }
  | {
      readonly kind: 'sanity-failed';
      readonly gain: number;
      readonly low: number;
      readonly high: number;
      readonly worseTasks: number;
    };

const noiseWarnings = (
  health: SetHealth,
  minGain: number,
  repeats: number,
): readonly SearchWarning[] => {
  const { noise } = health;

  if (!noise) {
    return [{ kind: 'noise-unmeasured' }];
  }

  return isNoisyAt(noise.spread, minGain, repeats)
    ? [
        {
          kind: 'noisy',
          spread: noise.spread,
          minGain,
          neededRepeats: neededRepeatsFor(noise.spread, minGain),
          suggestedRepeats: suggestedRepeatsFor(noise.spread, minGain),
        },
      ]
    : [];
};

const healthWarnings = (health: SetHealth): readonly SearchWarning[] => {
  const { saturation, judge, checks, sanity } = health;

  return [
    ...(saturation?.saturated
      ? [{ kind: 'saturated' as const, rate: saturation.rate }]
      : []),
    ...(judge?.unstable && judge.agreement !== null
      ? [
          {
            kind: 'judge-unstable' as const,
            agreement: judge.agreement,
            compared: judge.compared,
          },
        ]
      : []),
    ...(checks && checks.flaky.length > 0
      ? [
          {
            kind: 'flaky-checks' as const,
            flaky: checks.flaky.length,
            rechecked: checks.rechecked,
          },
        ]
      : []),
    ...(sanity?.rewardsStrongerModel === false && sanity.gain
      ? [
          {
            kind: 'sanity-failed' as const,
            gain: sanity.gain.gain,
            low: sanity.gain.low,
            high: sanity.gain.high,
            worseTasks: sanity.worse.length,
          },
        ]
      : []),
  ];
};

export const searchWarningsOf = (
  health: SetHealth,
  minGain: number,
  repeats: number,
): readonly SearchWarning[] => [
  ...noiseWarnings(health, minGain, repeats),
  ...healthWarnings(health),
];
