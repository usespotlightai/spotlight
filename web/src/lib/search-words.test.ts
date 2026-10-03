import { describe, expect, it } from 'vitest';
import {
  endingShown,
  pullRequestReasonShown,
  repeatsSuggestionShown,
  searchStateShown,
  verdictShown,
  warningShown,
} from '@/lib/search-words';

describe('search words', () => {
  it('says what a search is doing in plain words', () => {
    expect(searchStateShown('seeding')).toBe('Replaying the live config');
    expect(searchStateShown('holding-out')).toBe('Checking on held-out tasks');
  });

  it('says why a search stopped', () => {
    expect(endingShown('stalled')).toBe(
      'It found nothing better twice in a row',
    );
  });

  it('says why no pull request was opened', () => {
    expect(
      pullRequestReasonShown({
        code: 'drifted',
        message: 'prompt.md changed',
        attribute: null,
        expression: null,
        wanted: null,
      }),
    ).toBe('The file changed since the search began');
  });

  it('says why a check went undecided', () => {
    expect(verdictShown('undecided', 'too-few-scored')).toBe(
      'Undecided: fewer than half the tasks were scored on both sides',
    );
    expect(verdictShown('passed')).toBe('Passed');
  });

  it('warns plainly when a set’s noise is unmeasured or too loud, naming the repeats that would help', () => {
    expect(warningShown({ kind: 'noise-unmeasured' })).toMatch(
      /^Nobody has measured how much this set’s success moves by chance/,
    );
    expect(
      warningShown({
        kind: 'noisy',
        spread: 0.12,
        minGain: 0.05,
        suggestedRepeats: 5,
        neededRepeats: 5,
      }),
    ).toBe(
      'This set’s success moved 12 pts between copies of the same runs, more than the +5 pts the line counts as real. Replaying each run 5 times would bring that down.',
    );
    expect(
      warningShown({
        kind: 'noisy',
        spread: 0.3,
        minGain: 0.05,
        suggestedRepeats: 5,
        neededRepeats: 36,
      }),
    ).toBe(
      'This set’s success moved 30 pts between copies of the same runs, more than the +5 pts the line counts as real. Even replaying each run 5 times, the most allowed, won’t bring it under that, so read small gains with care or raise the line’s smallest real gain.',
    );
    expect(repeatsSuggestionShown(3)).toBe('Replay each run 3 times');
  });
});
