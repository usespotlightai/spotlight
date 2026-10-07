export class InvalidToolError extends Error {
  readonly violation = 'invalid' as const;

  constructor(tool: string, because: string) {
    super(`Tool ${tool} ${because}.`);
    this.name = 'InvalidToolError';
  }
}
