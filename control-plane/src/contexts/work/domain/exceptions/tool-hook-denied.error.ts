export class ToolHookDeniedError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor(tool: string, reason: string) {
    super(
      [`A hook stopped ${tool}, so nothing was sent.`, reason.trim()]
        .filter(Boolean)
        .join(' '),
    );
    this.name = 'ToolHookDeniedError';
  }
}
