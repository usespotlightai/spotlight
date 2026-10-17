export class NotAllowedInSearchError extends Error {
  readonly violation = 'conflict' as const;

  constructor(what: string) {
    super(`A search cannot ${what}.`);
    this.name = 'NotAllowedInSearchError';
  }
}
