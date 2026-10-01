import { roundAfter } from '@work/domain/services/station-round';
import { describe, expect, it } from 'vitest';

describe('roundAfter', () => {
  it('counts the runs that finished or failed before, leaving out superseded ones and those still going', () => {
    expect(roundAfter([])).toBe(1);
    expect(
      roundAfter(['completed', 'superseded', 'failed', 'claimed', 'queued']),
    ).toBe(3);
  });
});
