import { NotAllowedInIsolatedRunError } from '@memory/domain/exceptions/not-allowed-in-isolated-run.error';
import {
  notAllowedInIsolatedRun,
  usesMemories,
} from '@memory/domain/services/isolated-run-memory-access';
import { describe, expect, it } from 'vitest';

describe('notAllowedInIsolatedRun', () => {
  it('stops a run isolated from the team from using what it remembers, and lets a trial or any other run use it', () => {
    expect(usesMemories({ isolated: true, trial: false })).toBe(false);
    expect(usesMemories({ isolated: false, trial: false })).toBe(true);
    expect(() =>
      notAllowedInIsolatedRun(
        { isolated: true, trial: false },
        'recall what the team remembers',
      ),
    ).toThrow(NotAllowedInIsolatedRunError);
    expect(() =>
      notAllowedInIsolatedRun(
        { isolated: false, trial: false },
        'recall what the team remembers',
      ),
    ).not.toThrow();
  });
});
