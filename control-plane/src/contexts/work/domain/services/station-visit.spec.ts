import { visitAfter } from '@work/domain/services/station-visit';
import { describe, expect, it } from 'vitest';

describe('visitAfter', () => {
  it('counts the runs that finished or failed before, leaving out superseded ones and those still going', () => {
    expect(visitAfter([])).toBe(1);
    expect(
      visitAfter(['completed', 'superseded', 'failed', 'claimed', 'queued']),
    ).toBe(3);
  });
});
