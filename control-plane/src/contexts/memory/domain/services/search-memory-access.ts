import { NotAllowedInSearchError } from '@memory/domain/exceptions/not-allowed-in-search.error';

export const usesMemories = (run: { readonly isSearch: boolean }): boolean =>
  !run.isSearch;

export const notAllowedInSearch = (
  run: { readonly isSearch: boolean },
  what: string,
): void => {
  if (!usesMemories(run)) {
    throw new NotAllowedInSearchError(what);
  }
};
