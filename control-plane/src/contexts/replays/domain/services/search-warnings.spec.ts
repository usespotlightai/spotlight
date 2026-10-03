import { FINGERPRINT, NOW } from '@replays/domain/replays.fake-spec';
import {
  searchWarningsOf,
  suggestedRepeatsFor,
} from '@replays/domain/services/search-warnings';
import type { SetNoise } from '@replays/domain/services/set-noise';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { describe, expect, it } from 'vitest';

const noiseOf = (spread: number): SetNoise => ({
  replayId: ReplayId.of('replay_noise'),
  fingerprint: FINGERPRINT,
  repeats: 3,
  perRepeat: [0.5, 0.5 + spread],
  spread,
  flippedTasks: [],
  measuredAt: NOW,
});

describe('suggestedRepeatsFor', () => {
  it('asks for enough copies to bring the noise under the min gain, from 1 to 5', () => {
    expect(suggestedRepeatsFor(0, 0.05)).toBe(1);
    expect(suggestedRepeatsFor(0.05, 0.05)).toBe(1);
    expect(suggestedRepeatsFor(0.1, 0.05)).toBe(4);
    expect(suggestedRepeatsFor(0.08, 0.05)).toBe(3);
    expect(suggestedRepeatsFor(0.5, 0.05)).toBe(5);
  });
});

describe('searchWarningsOf', () => {
  it('warns that nobody measured the noise yet', () => {
    expect(searchWarningsOf(null, 0.05, 1)).toEqual([
      { kind: 'noise-unmeasured' },
    ]);
  });

  it('warns that a noisy set needs more copies than asked, and says how many', () => {
    expect(searchWarningsOf(noiseOf(0.1), 0.05, 1)).toEqual([
      {
        kind: 'noisy',
        spread: 0.1,
        minGain: 0.05,
        neededRepeats: 4,
        suggestedRepeats: 4,
      },
    ]);
    expect(searchWarningsOf(noiseOf(0.1), 0.05, 4)).toEqual([]);
    expect(searchWarningsOf(noiseOf(0.02), 0.05, 1)).toEqual([]);
  });

  it('still warns at five repeats when the set needs more than five, saying how many it needs', () => {
    expect(searchWarningsOf(noiseOf(0.5), 0.05, 5)).toEqual([
      {
        kind: 'noisy',
        spread: 0.5,
        minGain: 0.05,
        neededRepeats: 100,
        suggestedRepeats: 5,
      },
    ]);
  });
});
