export class SearchRunNotHeldError extends Error {
  readonly violation = 'not-found' as const;

  constructor() {
    super('The search no longer holds this run');
    this.name = 'SearchRunNotHeldError';
  }
}
