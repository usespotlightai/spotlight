export class UnreadyRepositoryError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Line ${because}.`);
    this.name = 'UnreadyRepositoryError';
  }
}
