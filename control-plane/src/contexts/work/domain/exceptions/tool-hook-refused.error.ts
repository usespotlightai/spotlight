export class ToolHookRefusedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(tool: string, reason: string) {
    super(
      [`${tool} was held back by a hook, so nothing was sent.`, reason.trim()]
        .filter(Boolean)
        .join(' '),
    );
    this.name = 'ToolHookRefusedError';
  }
}
