export class InvalidAgentPromptError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Agent prompt ${reason}.`);
    this.name = 'InvalidAgentPromptError';
  }
}
