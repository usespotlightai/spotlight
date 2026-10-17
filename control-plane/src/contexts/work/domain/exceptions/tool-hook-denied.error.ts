export class ToolHookDeniedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(tool: string, reason: string) {
    super(
      [`A hook stopped ${tool}, so nothing was sent.`, reason.trim()]
        .filter(Boolean)
        .join(' '),
    );
    this.name = 'ToolHookDeniedError';
  }
}
