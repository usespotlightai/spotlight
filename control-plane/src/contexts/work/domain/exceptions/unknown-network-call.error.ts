export class UnknownNetworkCallError extends Error {
  readonly violation = 'not-found' as const;

  constructor(id: string) {
    super(`Network call ${id} not found.`);
    this.name = 'UnknownNetworkCallError';
  }
}
