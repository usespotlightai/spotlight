export class EmailAlreadyAddedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(`${email} was just added. Please reload and try again.`);
    this.name = 'EmailAlreadyAddedError';
  }
}
