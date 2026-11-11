import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkingCopyArchiveVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Working copy archive ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'WorkingCopyArchiveVersionConflictError';
  }
}
