import {
  type PickedResult,
  type RequestedResult,
  type SearchSummary,
  SearchResultWording,
} from '@replays/application/rendering/search-result-notice';
import { describe, expect, it } from 'vitest';

const PICKED: PickedResult = {
  objective: 'success',
  stationName: 'Build',
  candidateName: 'shorter-prompt',
  changes: ['prompt'],
  heldOutGain: 0.12,
  costPerRun: 0.4,
  liveCostPerRun: 0.8,
  currency: 'USD',
};

const REQUESTED: RequestedResult = {
  objective: 'success',
  candidateName: 'asked',
  replayed: 'finished',
  heldOutGain: null,
  searchedGain: 0.25,
  searched: { successRate: 0.5, tasks: 4, tasksScored: 4 },
  spent: { spent: 0.8, share: 1 },
  costPerRun: null,
  liveCostPerRun: null,
  currency: 'USD',
};

const SUMMARY: SearchSummary = {
  currency: 'USD',
  ceiling: 10,
  spent: 9.2,
  stopReason: 'iterations-spent',
  candidateFinished: true,
  live: {
    replayed: 'finished',
    calibrates: false,
    tasks: 6,
    repeats: 1,
    searched: { successRate: 0.25, tasks: 4, tasksScored: 4 },
    spent: { spent: 2, share: 2.5 },
  },
  checks: { ran: 10, skipped: [] },
};

describe('SearchResultWording', () => {
  it('tells the held-out gain of a candidate a success search picked', () => {
    expect(SearchResultWording.opened(PICKED)).toEqual({
      headline: 'Spotlight opened a config pull request for the Build station',
      points: [
        'Candidate shorter-prompt changes prompt.',
        'Held-out gain: +12 points',
      ],
    });
  });

  it('tells the cost per run against the live config for a candidate a cost search picked', () => {
    expect(
      SearchResultWording.opened({ ...PICKED, objective: 'cost' }).points,
    ).toEqual([
      'Candidate shorter-prompt changes prompt.',
      'Cost per run: 0.40 USD, against 0.80 USD for the live config',
    ]);
    expect(
      SearchResultWording.opened({
        ...PICKED,
        objective: 'cost',
        liveCostPerRun: null,
      }).points[1],
    ).toBe('Cost per run: not measured');
  });

  it('tells how the live config and the asked candidate scored on the searched tasks, and that checks ran', () => {
    expect(
      SearchResultWording.declined(
        'Build',
        'no-candidate',
        [REQUESTED],
        SUMMARY,
      ).points,
    ).toEqual([
      'No candidate did better than the live config on the searched tasks.',
      'Live config: 25% success on 4 searched tasks.',
      'Candidate asked: 50% success on 4 searched tasks. It did not beat the live config there. Searched gain: +25 points',
      'Checks ran in 10 replayed runs.',
    ]);
  });

  it('tells why the search ended before the asked candidate finished, and how it did until then', () => {
    expect(
      SearchResultWording.stopped(
        'Build',
        'turned-off',
        [
          {
            ...REQUESTED,
            replayed: 'unfinished',
            searched: { successRate: 1, tasks: 4, tasksScored: 1 },
          },
        ],
        { ...SUMMARY, checks: { ran: 0, skipped: [] } },
      ).points,
    ).toEqual([
      'A person turned off search for the station.',
      'Live config: 25% success on 4 searched tasks.',
      'Spotlight did not finish the replay of asked: the search used all its iterations first. So far: 100% success on 1 of 4 searched tasks.',
    ]);
  });

  it('tells each reason checks did not run, and what the search spent of its ceiling when another iteration did not fit', () => {
    expect(
      SearchResultWording.declined(
        'Build',
        'no-candidate',
        [{ ...REQUESTED, replayed: null }],
        {
          ...SUMMARY,
          stopReason: 'ceiling-reached',
          candidateFinished: false,
          checks: {
            ran: 2,
            skipped: [
              { skip: 'checkout-failed', runs: 6 },
              { skip: 'not-generated', runs: 2 },
            ],
          },
        },
      ).points,
    ).toEqual([
      'No candidate finished its replay of the searched tasks.',
      'Live config: 25% success on 4 searched tasks.',
      'Spotlight did not replay asked: the search reached its ceiling first.',
      'Checks did not run in 8 of 10 replayed runs: the checkout failed in 6, the change was not made in 2. A run without checks counts only when the judge fails it.',
      'The live config replayed 6 tasks. It spent 2.00 USD, and its share of the 10.00 USD search ceiling was 2.50 USD.',
      'The search spent 9.20 USD of its 10.00 USD ceiling, and another iteration did not fit.',
    ]);
  });
});
