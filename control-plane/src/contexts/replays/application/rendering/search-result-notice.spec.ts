import {
  type PickedResult,
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
});
