import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TaskBlockingCycleError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(blocker: string) {
    super(
      `${blocker} already waits for this task. Two tasks cannot wait for each other.`,
    );
    this.name = 'TaskBlockingCycleError';
  }
}
