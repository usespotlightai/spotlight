export class UnknownToolError extends Error {
  readonly kind = 'not-found' as const;

  constructor(tool: string) {
    super(`Tool ${tool} not found.`);
    this.name = 'UnknownToolError';
  }
}
