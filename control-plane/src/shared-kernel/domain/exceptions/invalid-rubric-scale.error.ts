export class InvalidRubricScaleError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A rubric's scale ${reason}`);
    this.name = 'InvalidRubricScaleError';
  }
}
