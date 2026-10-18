export class InvalidReplaySetError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Replay set ${reason}.`);
    this.name = 'InvalidReplaySetError';
  }
}
