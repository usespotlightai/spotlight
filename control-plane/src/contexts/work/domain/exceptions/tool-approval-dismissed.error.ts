export class ToolApprovalDismissedError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor(tool: string, comment: string) {
    super(
      [`${tool} was dismissed, so nothing was sent.`, comment.trim()]
        .filter(Boolean)
        .join(' '),
    );
    this.name = 'ToolApprovalDismissedError';
  }
}
