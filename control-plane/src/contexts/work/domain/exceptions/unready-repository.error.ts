export class UnreadyRepositoryError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`A line ${because}`);
    this.name = 'UnreadyRepositoryError';
  }
}
