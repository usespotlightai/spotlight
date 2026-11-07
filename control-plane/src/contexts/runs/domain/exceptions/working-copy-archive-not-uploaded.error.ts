import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkingCopyArchiveNotUploadedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string, reason: string) {
    super(`Working copy archive ${id} ${reason}.`);
    this.name = 'WorkingCopyArchiveNotUploadedError';
  }
}
