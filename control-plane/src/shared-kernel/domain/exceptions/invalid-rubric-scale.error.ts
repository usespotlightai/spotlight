export class InvalidRubricScaleError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Rubric scale ${reason}.`);
    this.name = 'InvalidRubricScaleError';
  }
}
