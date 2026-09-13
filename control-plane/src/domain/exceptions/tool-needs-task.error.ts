export class ToolNeedsTaskError extends Error {
  readonly violation = 'conflict' as const;

  constructor(tool: string) {
    super(`${tool} is used on a task, and this run works none`);
    this.name = 'ToolNeedsTaskError';
  }
}
