export class InvalidNetworkCallTransitionError extends Error {
  readonly violation = 'conflict' as const;

  constructor(reason: string) {
    super(`A network call ${reason}`);
    this.name = 'InvalidNetworkCallTransitionError';
  }
}
