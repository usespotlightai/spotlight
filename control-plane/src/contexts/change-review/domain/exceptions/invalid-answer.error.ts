export class InvalidAnswerError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`An answer ${reason}.`);
    this.name = 'InvalidAnswerError';
  }
}
