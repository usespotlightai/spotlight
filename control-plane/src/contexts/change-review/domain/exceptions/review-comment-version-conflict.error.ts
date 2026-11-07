import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReviewCommentVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Review comment ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ReviewCommentVersionConflictError';
  }
}
