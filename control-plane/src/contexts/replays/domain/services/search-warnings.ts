import type { SetHealth } from '@replays/domain/services/set-health';
import {
  isNoisyAt,
  neededRepeatsFor,
  suggestedRepeatsFor,
} from '@replays/domain/services/set-noise';
import type { JudgeCalibration } from '@replays/domain/value-objects/judge-calibration';

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
      readonly kind: 'judge-disagrees-with-people';
      readonly agreement: number | null;
      readonly minAgreement: number | null;
      readonly pairs: number;
    }
  | {
      readonly kind: 'judge-unmeasured';
      readonly pairs: number;
      readonly minPairs: number;
    }
  | {
      readonly kind: 'flaky-checks';
      readonly flaky: number;
      readonly rechecked: number;
    }
  | {
      readonly kind: 'no-headroom';
      readonly gain: number;
      readonly low: number;
      readonly high: number;
      readonly answered: number;
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
  const { saturation, judge, checks, oracle } = health;

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
    ...(oracle?.roomToImprove === false && oracle.gain
      ? [
          {
            kind: 'no-headroom' as const,
            gain: oracle.gain.gain,
            low: oracle.gain.low,
            high: oracle.gain.high,
            answered: oracle.answered,
          },
        ]
      : []),
  ];
};

export const calibrationWarningsOf = (
  calibration: JudgeCalibration | null,
): readonly SearchWarning[] => {
  switch (calibration?.state) {
    case 'failing':
      return [
        {
          kind: 'judge-disagrees-with-people',
          agreement: calibration.agreement,
          minAgreement: calibration.minAgreement,
          pairs: calibration.pairs,
        },
      ];
    case 'unmeasured':
      return [
        {
          kind: 'judge-unmeasured',
          pairs: calibration.pairs,
          minPairs: calibration.minPairs,
        },
      ];
    case 'qualified':
    case undefined:
      return [];
  }
};

export const searchWarningsOf = (
  health: SetHealth,
  minGain: number,
  repeats: number,
  calibration: JudgeCalibration | null,
): readonly SearchWarning[] => [
  ...noiseWarnings(health, minGain, repeats),
  ...healthWarnings(health),
  ...calibrationWarningsOf(calibration),
];
