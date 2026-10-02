import { describe, expect, it } from 'vitest';
import {
  endingShown,
  pullRequestReasonShown,
  searchStateShown,
  verdictShown,
} from '@/lib/search-words';

describe('search words', () => {
  it('says what a search is doing in plain words', () => {
    expect(searchStateShown('seeding')).toBe('Replaying the live config');
    expect(searchStateShown('holding-out')).toBe('Checking on held-out tasks');
  });

  it('says why a search stopped', () => {
    expect(endingShown('stalled')).toBe(
      'Two iterations in a row found nothing, so it stopped',
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
});
