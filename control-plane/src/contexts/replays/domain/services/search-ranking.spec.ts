import { rankedOf } from '@replays/domain/services/search-ranking';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { describe, expect, it } from 'vitest';

const point = (
  id: string,
  over: Partial<{
    seed: boolean;
    searchScore: number | null;
    heldOutScore: number | null;
    costPerRun: number | null;
  }> = {},
) => ({
  candidateId: CandidateId.of(id),
  seed: over.seed ?? false,
  searchScore: over.searchScore ?? null,
  heldOutScore: over.heldOutScore ?? null,
  costPerRun: over.costPerRun ?? null,
});

const names = (points: readonly { candidateId: CandidateId }[]) =>
  points.map((each) => each.candidateId.value);

describe('rankedOf', () => {
  it('ranks by search score while no candidate was held out, the seed’s held-out score set aside', () => {
    expect(
      names(
        rankedOf([
          point('seed', { seed: true, searchScore: 0.5, heldOutScore: 1 }),
          point('terse', { searchScore: 0.8, costPerRun: 2 }),
          point('firmer', { searchScore: 0.8, costPerRun: 1 }),
          point('unscored'),
        ]),
      ),
    ).toEqual(['firmer', 'terse', 'seed']);
  });

  it('ranks by held-out score alone once a candidate was held out, among those with one, the seed included', () => {
    expect(
      names(
        rankedOf([
          point('seed', { seed: true, searchScore: 0.4, heldOutScore: 0.7 }),
          point('overfit', { searchScore: 1, heldOutScore: 0.3 }),
          point('steady', { searchScore: 0.7, heldOutScore: 0.9 }),
          point('unheld', { searchScore: 0.95 }),
        ]),
      ),
    ).toEqual(['steady', 'seed', 'overfit']);
  });

  it('breaks a tie on score by cost, then by id, unpriced last', () => {
    expect(
      names(
        rankedOf([
          point('b', { searchScore: 1 }),
          point('a', { searchScore: 1 }),
          point('c', { searchScore: 1, costPerRun: 3 }),
        ]),
      ),
    ).toEqual(['c', 'a', 'b']);
  });
});
