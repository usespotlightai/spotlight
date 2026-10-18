export class InvalidReplayError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Replay ${reason}.`);
    this.name = 'InvalidReplayError';
  }
}
