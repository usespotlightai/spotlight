export class ToolNeedsWorkError extends Error {
  readonly kind = 'conflict' as const;

  constructor(tool: string) {
    super(`${tool} is used on what a run works, and this run works nothing`);
    this.name = 'ToolNeedsWorkError';
  }
}
