import { draftsMemoriesAfter } from '@memory/domain/services/memory-drafting-policy';
import { describe, expect, it } from 'vitest';

describe('drafting memories after a run', () => {
  it('drafts when a run or a turn hands the work over, at a station that has memories turned on', () => {
    expect(draftsMemoriesAfter({ memories: true }, true)).toBe(true);
    expect(draftsMemoriesAfter({ memories: false }, true)).toBe(false);
  });

  it('drafts nothing when a run or a turn hands nothing over', () => {
    expect(draftsMemoriesAfter({ memories: true }, false)).toBe(false);
  });
});
