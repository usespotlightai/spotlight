import { runNumberAfter } from '@work/domain/services/station-run-number';
import { describe, expect, it } from 'vitest';

describe('runNumberAfter', () => {
  it('counts the runs that finished or failed before, leaving out superseded ones and those still going', () => {
    expect(runNumberAfter([])).toBe(1);
    expect(
      runNumberAfter([
        'completed',
        'superseded',
        'failed',
        'claimed',
        'queued',
      ]),
    ).toBe(3);
  });
});
