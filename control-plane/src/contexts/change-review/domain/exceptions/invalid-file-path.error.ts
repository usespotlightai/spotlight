export class InvalidFilePathError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A file path ${reason}.`);
    this.name = 'InvalidFilePathError';
  }
}
