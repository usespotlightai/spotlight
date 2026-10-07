export class InvalidReplayError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Replay ${reason}.`);
    this.name = 'InvalidReplayError';
  }
}
