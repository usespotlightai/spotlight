import {
  searchResultText,
  skipReasonText,
} from '@replays/application/rendering/station-improvement-words';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import type { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import { SEARCH_SKIP_REASONS } from '@replays/domain/value-objects/search-skip-reason';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it } from 'vitest';

const TERSE = CandidateId.of('candidate_terse');

const finished = (part: Partial<Search>): Search =>
  partial<Search>({
    current: 'finished',
    stopReason: 'iterations-spent',
    isActive: false,
    awaitsPick: false,
    pickedCandidate: null,
    pick: null,
    anyCandidateFinished: true,
    proposals: [
      partial<SearchProposal>({
        candidateId: TERSE,
        name: CandidateName.searched('terse'),
      }),
    ],
    ...part,
  });

describe('skipReasonText', () => {
  it('says each reason a search was skipped in its own words', () => {
    const texts = SEARCH_SKIP_REASONS.map(skipReasonText);

    expect(new Set(texts).size).toBe(SEARCH_SKIP_REASONS.length);
    expect(texts.every((each) => each.endsWith('.'))).toBe(true);
  });

  it('says how many tasks a search needs when the set is too small', () => {
    expect(skipReasonText('set-too-small')).toContain('at least 5');
  });

  it('says what a person must fix when only a person can', () => {
    expect(skipReasonText('no-scoring')).toBe(
      'The station has no judge and no check. Spotlight cannot score a config without one of them. Please add a judge or a check to the station in the Terraform of the line.',
    );
  });
});

describe('searchResultText', () => {
  it('says nothing while the search runs', () => {
    expect(
      searchResultText(finished({ current: 'searching', isActive: true })),
    ).toBeNull();
  });

  it('says why a stopped search stopped', () => {
    expect(
      searchResultText(
        finished({ current: 'stopped', stopReason: 'seed-failed' }),
      ),
    ).toBe('The replay of the live config failed.');
  });

  it('says Spotlight is picking while the search awaits its pick', () => {
    expect(searchResultText(finished({ awaitsPick: true }))).toBe(
      'Spotlight is picking a candidate.',
    );
  });

  it('names the candidate Spotlight picked', () => {
    expect(searchResultText(finished({ pickedCandidate: TERSE }))).toBe(
      'Spotlight picked candidate terse for a config pull request.',
    );
  });

  it('says why Spotlight picked none, as its notice does', () => {
    expect(
      searchResultText(
        finished({ pick: { outcome: 'declined', reason: 'no-held-out-gain' } }),
      ),
    ).toBe(
      'No candidate did better than the live config on the held-out tasks.',
    );
    expect(
      searchResultText(
        finished({
          pick: { outcome: 'declined', reason: 'no-candidate' },
          anyCandidateFinished: false,
        }),
      ),
    ).toBe('No candidate finished its replay of the searched tasks.');
  });
});
