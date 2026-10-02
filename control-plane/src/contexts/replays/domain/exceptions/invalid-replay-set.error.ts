export class InvalidReplaySetError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A replay set ${reason}`);
    this.name = 'InvalidReplaySetError';
  }
}
