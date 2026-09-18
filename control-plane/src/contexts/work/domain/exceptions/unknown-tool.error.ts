export class UnknownToolError extends Error {
  readonly violation = 'not-found' as const;

  constructor(tool: string) {
    super(`There is no tool ${tool}`);
    this.name = 'UnknownToolError';
  }
}
