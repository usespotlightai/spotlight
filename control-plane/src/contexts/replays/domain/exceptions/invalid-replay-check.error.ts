export class InvalidReplayCheckError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`A replay check ${reason}`);
    this.name = 'InvalidReplayCheckError';
  }
}
