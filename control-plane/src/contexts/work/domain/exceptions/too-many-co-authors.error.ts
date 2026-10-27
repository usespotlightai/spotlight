export class TooManyCoAuthorsError extends Error {
  readonly kind = 'invalid' as const;

  constructor(limit: number) {
    super(`A message can name at most ${limit} co-authors.`);
    this.name = 'TooManyCoAuthorsError';
  }
}
