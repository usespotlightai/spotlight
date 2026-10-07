export class InvalidRubricScaleError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Rubric scale ${reason}.`);
    this.name = 'InvalidRubricScaleError';
  }
}
