import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspaceArchiveNotUploadedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string, reason: string) {
    super(`Workspace archive ${id} ${reason}.`);
    this.name = 'WorkspaceArchiveNotUploadedError';
  }
}
