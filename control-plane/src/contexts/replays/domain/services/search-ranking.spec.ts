import type { GainSignificance } from '@replays/domain/services/gain-estimate';
import { rankedOf } from '@replays/domain/services/search-ranking';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { describe, expect, it } from 'vitest';

const point = (
  id: string,
  over: Partial<{
    seed: boolean;
    searchScore: number | null;
    heldOutScore: number | null;
    searchedSignificance: GainSignificance | null;
    heldOutSignificance: GainSignificance | null;
    costPerRun: number | null;
  }> = {},
) => ({
  candidateId: CandidateId.of(id),
  seed: over.seed ?? false,
  searchScore: over.searchScore ?? null,
  heldOutScore: over.heldOutScore ?? null,
  searchedSignificance:
    over.searchedSignificance === undefined
      ? 'within-noise'
      : over.searchedSignificance,
  heldOutSignificance:
    over.heldOutSignificance === undefined
      ? 'within-noise'
      : over.heldOutSignificance,
  costPerRun: over.costPerRun ?? null,
});

const names = (points: readonly { candidateId: CandidateId }[]) =>
  points.map((each) => each.candidateId.value);

describe('rankedOf', () => {
  it('ranks by search score while no candidate was held out, the seed’s held-out score set aside', () => {
    expect(
      names(
        rankedOf(
          [
            point('seed', { seed: true, searchScore: 0.5, heldOutScore: 1 }),
            point('terse', { searchScore: 0.8, costPerRun: 2 }),
            point('firmer', { searchScore: 0.8, costPerRun: 1 }),
            point('unscored'),
          ],
          'success',
        ),
      ),
    ).toEqual(['firmer', 'terse', 'seed']);
  });

  it('ranks by held-out score alone once a candidate was held out, among those with one, the seed included', () => {
    expect(
      names(
        rankedOf(
          [
            point('seed', { seed: true, searchScore: 0.4, heldOutScore: 0.7 }),
            point('overfit', { searchScore: 1, heldOutScore: 0.3 }),
            point('steady', { searchScore: 0.7, heldOutScore: 0.9 }),
            point('searched-only', { searchScore: 0.95 }),
          ],
          'success',
        ),
      ),
    ).toEqual(['steady', 'seed', 'overfit']);
  });

  it('breaks a tie on score by cost, then by id, unpriced last', () => {
    expect(
      names(
        rankedOf(
          [
            point('b', { searchScore: 1 }),
            point('a', { searchScore: 1 }),
            point('c', { searchScore: 1, costPerRun: 3 }),
          ],
          'success',
        ),
      ),
    ).toEqual(['c', 'a', 'b']);
  });

  it('ranks, when it looks for cost, the cheapest of those that succeed as often as the seed within noise first, the seed among them', () => {
    expect(
      names(
        rankedOf(
          [
            point('seed', { seed: true, searchScore: 0.96, costPerRun: 2 }),
            point('cheap-but-worse', {
              searchScore: 0.7,
              costPerRun: 0.5,
              searchedSignificance: 'worse',
            }),
            point('cheaper', { searchScore: 0.94, costPerRun: 1 }),
            point('better-and-dear', {
              searchScore: 1,
              costPerRun: 3,
              searchedSignificance: 'better',
            }),
            point('uncompared', { searchScore: 1, searchedSignificance: null }),
          ],
          'cost',
        ),
      ),
    ).toEqual(['cheaper', 'seed', 'better-and-dear']);
  });

  it('judges, when it looks for cost, by the held-out gain once a candidate was held out', () => {
    expect(
      names(
        rankedOf(
          [
            point('seed', {
              seed: true,
              searchScore: 0.9,
              heldOutScore: 0.9,
              costPerRun: 2,
            }),
            point('overfit', {
              searchScore: 0.9,
              heldOutScore: 0.6,
              costPerRun: 0.5,
              heldOutSignificance: 'worse',
            }),
            point('steady', {
              searchScore: 0.9,
              heldOutScore: 0.88,
              costPerRun: 1,
              searchedSignificance: 'worse',
            }),
          ],
          'cost',
        ),
      ),
    ).toEqual(['steady', 'seed']);
  });
});
