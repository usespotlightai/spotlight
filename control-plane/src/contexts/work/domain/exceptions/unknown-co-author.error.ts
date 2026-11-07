import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownCoAuthorError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(userId: string) {
    super(
      `Co-author ${userId} cannot see this workspace, so they cannot have written the draft.`,
    );
    this.name = 'UnknownCoAuthorError';
  }
}
