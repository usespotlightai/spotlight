export class UnknownToolError extends Error {
  readonly violation = 'not-found' as const;

  constructor(tool: string) {
    super(`Tool ${tool} not found.`);
    this.name = 'UnknownToolError';
  }
}
