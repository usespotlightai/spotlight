import { describe, expect, it } from 'vitest';
import {
  formatCheckResult,
  formatGainNote,
  formatPick,
  formatPullRequestReason,
  formatSearchState,
  formatSkip,
  formatStopReason,
  formatTrigger,
  formatTriggerLabel,
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

  it('says how Spotlight started a search, and what it did with the candidates', () => {
    expect(formatTriggerLabel('alert')).toBe('After a station alert');
    expect(formatTrigger('schedule')).toBe(
      'Spotlight started this search. The period of the search policy ran out.',
    );

    const picked = {
      outcome: 'picked' as const,
      candidateId: 'c',
      name: 'tests-first',
      reason: null,
    };

    expect(
      formatPick(picked, {
        state: 'opened',
        closedBecause: null,
        closeFailure: null,
      }),
    ).toBe('Spotlight opened a config pull request for tests-first.');
    expect(
      formatPick(picked, {
        state: 'failed',
        closedBecause: null,
        closeFailure: null,
      }),
    ).toBe(
      'Spotlight picked tests-first. Its config pull request could not be opened.',
    );
    expect(
      formatPick(picked, {
        state: 'merged',
        closedBecause: null,
        closeFailure: null,
      }),
    ).toBe('The config pull request for tests-first merged.');
    expect(
      formatPick(picked, {
        state: 'closed',
        closedBecause: 'by-person',
        closeFailure: null,
      }),
    ).toBe(
      "The config pull request for tests-first is closed. The pull request was closed on GitHub. Spotlight does not propose this config again while the station's live config stays the same.",
    );
    expect(
      formatPick(
        {
          outcome: 'declined',
          candidateId: null,
          name: null,
          reason: 'rejected-before',
        },
        null,
      ),
    ).toBe(
      "A config pull request for each passing candidate was closed on GitHub before. Spotlight does not propose these configs again while the station's live config stays the same.",
    );
    expect(formatPick(picked, null)).toBe(
      'Spotlight picked tests-first. Its config pull request is opening.',
    );
  });

  it('says why Spotlight did not start a search, with the minimum the server sends', () => {
    expect(
      formatSkip({
        lastStartedAt: null,
        lastSkip: { reason: 'set-too-small', at: '2026-10-01T09:00:00.000Z' },
        lastImprovedAt: null,
        checkAfter: '2026-10-02T09:00:00.000Z',
        minimumTasks: 6,
      }),
    ).toBe(
      'Spotlight did not start a search: the replay set has too few tasks. Minimum tasks: 6',
    );
  });
});
