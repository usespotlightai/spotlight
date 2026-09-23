export class InvalidFilePathError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A file path ${reason}`);
    this.name = 'InvalidFilePathError';
  }
}
