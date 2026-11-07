import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ToolApprovalDismissedError extends DomainError {
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
