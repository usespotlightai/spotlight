export class NoStackForSearchesError extends Error {
  readonly violation = 'conflict' as const;

  constructor() {
    super('A search run has no change stack. It changes no repository.');
    this.name = 'NoStackForSearchesError';
  }
}
