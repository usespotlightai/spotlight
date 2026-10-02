import { KeptFromSearchesError } from '@memory/domain/exceptions/kept-from-searches.error';
import {
  keptFromSearches,
  reachesMemories,
} from '@memory/domain/services/search-reach';
import { describe, expect, it } from 'vitest';

describe('keptFromSearches', () => {
  it('keeps a search from what the team remembers, and lets any other run reach it', () => {
    expect(reachesMemories({ isSearch: true })).toBe(false);
    expect(reachesMemories({ isSearch: false })).toBe(true);
    expect(() =>
      keptFromSearches({ isSearch: true }, 'recall what the team remembers'),
    ).toThrow(KeptFromSearchesError);
    expect(() =>
      keptFromSearches({ isSearch: false }, 'recall what the team remembers'),
    ).not.toThrow();
  });
});
