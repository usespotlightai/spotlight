export class ToolNotEnabledError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(tool: string) {
    super(`This run does not have ${tool} enabled`);
    this.name = 'ToolNotEnabledError';
  }
}
