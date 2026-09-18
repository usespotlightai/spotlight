export class ToolNotGivenError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(tool: string) {
    super(`This run was not given ${tool}`);
    this.name = 'ToolNotGivenError';
  }
}
