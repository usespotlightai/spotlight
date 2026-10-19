export class InvalidReleaseError extends Error {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Release ${because}.`);
    this.name = 'InvalidReleaseError';
  }
}
