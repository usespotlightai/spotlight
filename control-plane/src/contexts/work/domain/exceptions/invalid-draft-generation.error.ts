export class InvalidDraftGenerationError extends Error {
  readonly kind = 'invalid' as const;

  constructor(value: number) {
    super(`Draft generation ${value} is not a whole number from zero.`);
    this.name = 'InvalidDraftGenerationError';
  }
}
