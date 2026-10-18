export class InvalidNetworkCallError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Network call ${reason}.`);
    this.name = 'InvalidNetworkCallError';
  }
}
