import { NotAllowedWithoutMemoriesError } from '@memory/domain/exceptions/not-allowed-without-memories.error';
import {
  notAllowedWithoutMemories,
  usesMemories,
} from '@memory/domain/services/run-memory-use';
import { describe, expect, it } from 'vitest';

describe('notAllowedWithoutMemories', () => {
  it('stops an isolated run that is not a trial from using what the team remembers, and lets a trial or any other run use it', () => {
    expect(usesMemories({ isolated: true, trial: false })).toBe(false);
    expect(usesMemories({ isolated: false, trial: false })).toBe(true);
    expect(() =>
      notAllowedWithoutMemories(
        { isolated: true, trial: false },
        'recall what the team remembers',
      ),
    ).toThrow(NotAllowedWithoutMemoriesError);
    expect(() =>
      notAllowedWithoutMemories(
        { isolated: false, trial: false },
        'recall what the team remembers',
      ),
    ).not.toThrow();
  });
});
