export class InvalidAnalysisPromptError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`An analysis prompt ${reason}`);
    this.name = 'InvalidAnalysisPromptError';
  }
}
