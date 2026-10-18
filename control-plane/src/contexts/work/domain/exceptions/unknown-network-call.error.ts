export class UnknownNetworkCallError extends Error {
  readonly kind = 'not-found' as const;

  constructor(id: string) {
    super(`Network call ${id} not found.`);
    this.name = 'UnknownNetworkCallError';
  }
}
