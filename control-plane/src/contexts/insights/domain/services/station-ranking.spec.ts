import { leftOutRunsFrom } from '@insights/domain/services/station-ranking';
import { describe, expect, it } from 'vitest';

describe('leftOutRunsFrom', () => {
  it('names the runs no station counts, the most first, then in the order of their causes', () => {
    expect(
      leftOutRunsFrom([
        { cause: 'cancelled', runs: 1 },
        { cause: 'infrastructure', runs: 1 },
        { cause: 'refused', runs: 3 },
        { cause: 'setup', runs: 0 },
      ]),
    ).toEqual([
      { cause: 'refused', runs: 3 },
      { cause: 'infrastructure', runs: 1 },
      { cause: 'cancelled', runs: 1 },
    ]);
  });
});
