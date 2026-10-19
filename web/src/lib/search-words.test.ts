import { describe, expect, it } from 'vitest';
import {
  formatCheckResult,
  formatGainNote,
  formatPullRequestReason,
  formatRepeatsSuggestion,
  formatSearchState,
  formatStopReason,
  formatWarning,
  overfitNote,
  regressionLimitNote,
  regressionsNote,
} from '@/lib/search-words';

describe('search words', () => {
  it('splits a candidate’s regressions into searched and held out, and says why it is over the limit', () => {
    expect(regressionsNote({ searched: 2, heldOut: null, total: 2 })).toEqual({
      rows: [['Searched', '2']],
    });
    expect(
      regressionLimitNote({ searched: 2, heldOut: 1, total: 3 }, 2),
    ).toEqual({
      title: 'Over the regression limit',
      rows: [
        ['Regressed', '3 tasks'],
        ['Line allows', '2'],
      ],
    });
  });

  it('gives a gain’s verdict and likely range, and nothing more', () => {
    const gain = { gain: 0.4, low: 0.09, high: 0.71, minGain: 0.05, tasks: 5 };
    expect(formatGainNote({ ...gain, significance: 'better' })).toEqual({
      title: 'Better',
      rows: [['Likely range', '+9 to +71 pts']],
    });
    expect(
      formatGainNote({ ...gain, significance: 'within-noise' }).title,
    ).toBe('Within noise');
  });

  it('names overfit first in an overfit mark’s tooltip', () => {
    expect(overfitNote('likely').title).toBe('Likely overfit');
    expect(overfitNote('too-few-held-out').title).toBe('Overfit unknown');
  });

  it('says what a search is doing in plain words', () => {
    expect(formatSearchState('seeding')).toBe('Replaying the live config');
    expect(formatSearchState('holding-out')).toBe('Checking on held-out tasks');
  });

  it('says why a search stopped', () => {
    expect(formatStopReason('stalled')).toBe(
      'Found nothing better twice in a row',
    );
  });

  it('says why no pull request was opened', () => {
    expect(
      formatPullRequestReason({
        code: 'base-changed',
        message: 'prompt.md changed',
        attribute: null,
        expression: null,
        wanted: null,
      }),
    ).toBe('File changed since the search began');
  });

  it('says why a check went undecided', () => {
    expect(formatCheckResult('undecided', 'too-few-scored')).toBe(
      'Undecided: under half the tasks scored on both sides',
    );
    expect(formatCheckResult('passed')).toBe('Passed');
  });

  it('warns plainly when a set’s noise is unmeasured or too loud, naming the repeats that would help', () => {
    expect(formatWarning({ kind: 'noise-unmeasured' })).toMatch(
      /^The set’s noise isn’t measured/,
    );
    expect(
      formatWarning({
        kind: 'noisy',
        spread: 0.12,
        minGain: 0.05,
        suggestedRepeats: 5,
        neededRepeats: 5,
      }),
    ).toBe(
      'Success moved 12 pts between repeats of the same runs. This is more than the line’s minimum real gain. If you replay each run 5 times, the noise falls below it. Minimum real gain: +5 pts',
    );
    expect(
      formatWarning({
        kind: 'noisy',
        spread: 0.3,
        minGain: 0.05,
        suggestedRepeats: 5,
        neededRepeats: 36,
      }),
    ).toBe(
      'Success moved 30 pts between repeats of the same runs. This is more than the line’s minimum real gain. Even the maximum of 5 repeats won’t bring the noise below it. Read small gains with care, or raise the line’s min_gain. Minimum real gain: +5 pts',
    );
    expect(formatRepeatsSuggestion(3)).toBe('Replay each run 3 times');
  });
});
