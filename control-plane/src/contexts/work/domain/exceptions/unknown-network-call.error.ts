export class UnknownNetworkCallError extends Error {
  readonly violation = 'not-found' as const;

  constructor(id: string) {
    super(`There is no network call ${id}`);
    this.name = 'UnknownNetworkCallError';
  }
}
