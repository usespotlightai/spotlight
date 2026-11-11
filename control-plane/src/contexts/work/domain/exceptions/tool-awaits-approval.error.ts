import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ToolAwaitsApprovalError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(tool: string) {
    super(
      `${tool} needs a person's approval before it runs, and they have been asked in their inbox. Nothing was sent. Stop here and end your turn: their answer comes back to you in this conversation.`,
    );
    this.name = 'ToolAwaitsApprovalError';
  }
}
