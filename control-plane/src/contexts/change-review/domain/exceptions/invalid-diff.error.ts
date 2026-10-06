export class InvalidDiffError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A diff ${reason}.`);
    this.name = 'InvalidDiffError';
  }
}
