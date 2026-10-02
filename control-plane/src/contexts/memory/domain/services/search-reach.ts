import { KeptFromSearchesError } from '@memory/domain/exceptions/kept-from-searches.error';

export const reachesMemories = (run: { readonly isSearch: boolean }): boolean =>
  !run.isSearch;

export const keptFromSearches = (
  run: { readonly isSearch: boolean },
  what: string,
): void => {
  if (!reachesMemories(run)) {
    throw new KeptFromSearchesError(what);
  }
};
