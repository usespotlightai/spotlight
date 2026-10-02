export class InvalidReplayError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A replay ${reason}`);
    this.name = 'InvalidReplayError';
  }
}
