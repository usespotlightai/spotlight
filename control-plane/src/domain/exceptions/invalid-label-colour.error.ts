export class InvalidLabelColourError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A label colour ${reason}`);
    this.name = 'InvalidLabelColourError';
  }
}
