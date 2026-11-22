import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryProposalSetAlreadyOpenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `Task ${taskId} already has a memory proposal set. Please reload and try again.`,
    );
    this.name = 'MemoryProposalSetAlreadyOpenError';
  }
}
