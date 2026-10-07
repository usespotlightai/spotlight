export class InvalidReplaySetError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Replay set ${reason}.`);
    this.name = 'InvalidReplaySetError';
  }
}
