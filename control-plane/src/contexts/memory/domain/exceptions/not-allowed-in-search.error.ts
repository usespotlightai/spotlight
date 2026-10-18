export class NotAllowedInSearchError extends Error {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(`A search cannot ${what}.`);
    this.name = 'NotAllowedInSearchError';
  }
}
