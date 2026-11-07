import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryDraftVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Memory draft ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'MemoryDraftVersionConflictError';
  }
}
