import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryDraftAlreadyOpenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `Task ${taskId} already has a memory draft. Please reload and try again.`,
    );
    this.name = 'MemoryDraftAlreadyOpenError';
  }
}
