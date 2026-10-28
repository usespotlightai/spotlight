import type { GainEstimate } from '@replays/domain/services/gain-estimate';
import { autoPickOf } from '@replays/domain/services/search-picks';
import { regressionsOf } from '@replays/domain/services/search-regressions';
import type { SearchScores } from '@replays/domain/services/search-scores';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { describe, expect, it } from 'vitest';

type Scored = SearchScores['candidates'][number];

const gain = (
  significance: GainEstimate['significance'],
  tasks = 6,
): GainEstimate => ({
  gain: significance === 'better' ? 0.3 : 0,
  low: significance === 'better' ? 0.1 : -0.1,
  high: 0.4,
  significance,
  minGain: 0.05,
  tasks,
});

const scored = (name: string, over: Partial<Scored> = {}): Scored => ({
  candidateId: CandidateId.of(name),
  searchedGain: gain('better'),
  heldOutGain: gain('better'),
  searchedPairs: null,
  heldOutPairs: null,
  searchedSignificance: 'better',
  heldOutSignificance: 'better',
  regressions: regressionsOf(0, 0),
  replayId: ReplayId.of(`replay_${name}`),
  heldOutReplayId: ReplayId.of(`held_out_${name}`),
  seed: false,
  finished: true,
  searchScore: 0.8,
  searchInterval: null,
  searchScored: 7,
  heldOutScore: 0.8,
  heldOutInterval: null,
  costPerRun: 1,
  spent: Money.none('USD'),
  ...over,
});

const SEED = scored('seed', {
  seed: true,
  searchedGain: null,
  heldOutGain: null,
  searchedSignificance: null,
  heldOutSignificance: null,
  heldOutReplayId: null,
  searchScore: 0.5,
  heldOutScore: 0.5,
  costPerRun: 1,
});

const THRESHOLD = ReplayThreshold.of({
  maxRegressions: 1,
  ceiling: 10,
  currency: 'USD',
  minGain: 0.05,
});

const scoresOf = (...candidates: Scored[]): SearchScores => ({
  seed: SEED,
  candidates,
});

describe('autoPickOf', () => {
  it('picks the top-ranked candidate that beat the live config on the held-out tasks', () => {
    expect(
      autoPickOf(
        scoresOf(
          scored('good', { heldOutScore: 0.8 }),
          scored('best', { heldOutScore: 0.9 }),
        ),
        'success',
        THRESHOLD,
      ),
    ).toEqual({ outcome: 'picked', candidateId: CandidateId.of('best') });
  });

  it('declines when no candidate was held out', () => {
    expect(
      autoPickOf(
        scoresOf(scored('searched only', { heldOutScore: null })),
        'success',
        THRESHOLD,
      ),
    ).toEqual({ outcome: 'declined', reason: 'no-candidate' });
    expect(autoPickOf(scoresOf(), 'success', THRESHOLD)).toEqual({
      outcome: 'declined',
      reason: 'no-candidate',
    });
  });

  it('declines a candidate whose held-out gain is within noise or worse', () => {
    for (const significance of ['within-noise', 'worse'] as const) {
      expect(
        autoPickOf(
          scoresOf(scored('flat', { heldOutSignificance: significance })),
          'success',
          THRESHOLD,
        ),
      ).toEqual({ outcome: 'declined', reason: 'no-held-out-gain' });
    }
  });

  it('declines a candidate over the regression limit of the line', () => {
    expect(
      autoPickOf(
        scoresOf(scored('regressing', { regressions: regressionsOf(1, 1) })),
        'success',
        THRESHOLD,
      ),
    ).toEqual({ outcome: 'declined', reason: 'over-regression-limit' });
    expect(
      autoPickOf(
        scoresOf(scored('regressing', { regressions: regressionsOf(1, 1) })),
        'success',
        null,
      ),
    ).toEqual({ outcome: 'picked', candidateId: CandidateId.of('regressing') });
  });

  it('declines a candidate likely overfit, with too few held-out tasks to tell', () => {
    expect(
      autoPickOf(
        scoresOf(scored('thin', { heldOutGain: gain('better', 2) })),
        'success',
        THRESHOLD,
      ),
    ).toEqual({ outcome: 'declined', reason: 'likely-overfit' });
  });

  it('passes over a failing top candidate to the next one that passes every gate', () => {
    expect(
      autoPickOf(
        scoresOf(
          scored('top', {
            heldOutScore: 0.95,
            regressions: regressionsOf(2, 0),
          }),
          scored('next', { heldOutScore: 0.85 }),
        ),
        'success',
        THRESHOLD,
      ),
    ).toEqual({ outcome: 'picked', candidateId: CandidateId.of('next') });
  });

  it('says why the top candidate failed when none passes', () => {
    expect(
      autoPickOf(
        scoresOf(
          scored('top', {
            heldOutScore: 0.95,
            regressions: regressionsOf(2, 0),
          }),
          scored('next', {
            heldOutScore: 0.6,
            heldOutSignificance: 'within-noise',
          }),
        ),
        'success',
        THRESHOLD,
      ),
    ).toEqual({ outcome: 'declined', reason: 'over-regression-limit' });
  });

  it('for less cost, picks a candidate that did as well on the held-out tasks and costs less per run than the live config', () => {
    const cheaper = scored('cheaper', {
      heldOutSignificance: 'within-noise',
      searchedGain: gain('within-noise'),
      heldOutGain: gain('within-noise'),
      costPerRun: 0.5,
    });

    expect(autoPickOf(scoresOf(cheaper), 'cost', THRESHOLD)).toEqual({
      outcome: 'picked',
      candidateId: CandidateId.of('cheaper'),
    });
  });

  it('for less cost, declines a candidate that costs as much, or did worse on the held-out tasks', () => {
    for (const candidate of [
      scored('same price', {
        heldOutSignificance: 'within-noise',
        costPerRun: 1,
      }),
      scored('worse', { heldOutSignificance: 'worse', costPerRun: 0.5 }),
      scored('unpriced', { costPerRun: null }),
    ]) {
      expect(autoPickOf(scoresOf(candidate), 'cost', THRESHOLD)).toEqual({
        outcome: 'declined',
        reason: 'not-cheaper',
      });
    }
  });
});
