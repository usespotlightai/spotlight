import { NotAllowedInSearchError } from '@memory/domain/exceptions/not-allowed-in-search.error';
import {
  notAllowedInSearch,
  usesMemories,
} from '@memory/domain/services/search-memory-access';
import { describe, expect, it } from 'vitest';

describe('notAllowedInSearch', () => {
  it('stops a search from using what the team remembers, and lets any other run use it', () => {
    expect(usesMemories({ isSearch: true })).toBe(false);
    expect(usesMemories({ isSearch: false })).toBe(true);
    expect(() =>
      notAllowedInSearch({ isSearch: true }, 'recall what the team remembers'),
    ).toThrow(NotAllowedInSearchError);
    expect(() =>
      notAllowedInSearch({ isSearch: false }, 'recall what the team remembers'),
    ).not.toThrow();
  });
});
