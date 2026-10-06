export class InvalidReplayCheckError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Replay check ${reason}.`);
    this.name = 'InvalidReplayCheckError';
  }
}
