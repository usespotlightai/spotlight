export class ToolConnectionDeniedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(tool: string, reason: string) {
    super(`${tool} was not used, so nothing was sent: ${reason}`);
    this.name = 'ToolConnectionDeniedError';
  }
}
