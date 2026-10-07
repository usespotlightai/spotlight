export class InvalidAgentPromptError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Agent prompt ${reason}.`);
    this.name = 'InvalidAgentPromptError';
  }
}
