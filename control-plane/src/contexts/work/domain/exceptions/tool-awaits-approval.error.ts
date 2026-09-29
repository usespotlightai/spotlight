export class ToolAwaitsApprovalError extends Error {
  readonly violation = 'conflict' as const;

  constructor(tool: string) {
    super(
      `${tool} needs a person's approval before it runs, and they have been asked in their inbox. Nothing was sent. Stop here and end your turn: their answer comes back to you in this conversation.`,
    );
    this.name = 'ToolAwaitsApprovalError';
  }
}
