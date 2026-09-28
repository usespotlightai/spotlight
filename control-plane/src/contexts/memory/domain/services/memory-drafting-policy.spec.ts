import { draftsMemoriesAfter } from '@memory/domain/services/memory-drafting-policy';
import { describe, expect, it } from 'vitest';

describe('drafting memories after a run', () => {
  it('drafts only after a run that completed at a station keeping memories', () => {
    expect(draftsMemoriesAfter({ completed: true, memories: true })).toBe(true);
    expect(draftsMemoriesAfter({ completed: false, memories: true })).toBe(
      false,
    );
    expect(draftsMemoriesAfter({ completed: true, memories: false })).toBe(
      false,
    );
  });
});
