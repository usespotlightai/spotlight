export class InvalidLabelNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A label name ${reason}`);
    this.name = 'InvalidLabelNameError';
  }
}
