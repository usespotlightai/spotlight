export class InvalidNetworkCallError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A network call ${reason}`);
    this.name = 'InvalidNetworkCallError';
  }
}
