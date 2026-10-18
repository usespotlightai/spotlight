export class SearchRunNotActiveError extends Error {
  readonly kind = 'not-found' as const;

  constructor() {
    super('This run is no longer the active run of the search');
    this.name = 'SearchRunNotActiveError';
  }
}
