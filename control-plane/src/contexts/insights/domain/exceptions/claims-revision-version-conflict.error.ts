import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ClaimsRevisionVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(revisionId: string) {
    super(
      `Claims revision ${revisionId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ClaimsRevisionVersionConflictError';
  }
}
