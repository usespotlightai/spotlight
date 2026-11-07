import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TaskBranchTakenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(branch: string) {
    super(`Branch ${branch} already belongs to another task.`);
    this.name = 'TaskBranchTakenError';
  }
}
