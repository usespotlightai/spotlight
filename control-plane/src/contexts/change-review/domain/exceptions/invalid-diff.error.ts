export class InvalidDiffError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A diff ${reason}.`);
    this.name = 'InvalidDiffError';
  }
}
