export class ToolApprovalRefusedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(tool: string, said: string) {
    super(
      [`${tool} was dismissed, so nothing was sent.`, said.trim()]
        .filter(Boolean)
        .join(' '),
    );
    this.name = 'ToolApprovalRefusedError';
  }
}
