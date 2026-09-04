export class InvalidReactionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A reaction ${reason}`);
    this.name = 'InvalidReactionError';
  }
}
