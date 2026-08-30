export class InvalidTemplateNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A template name ${reason}`);
    this.name = 'InvalidTemplateNameError';
  }
}
