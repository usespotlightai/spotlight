import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TaskHumanActionsVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `People’s actions on task ${taskId} changed since you loaded them. Please reload and try again.`,
    );
    this.name = 'TaskHumanActionsVersionConflictError';
  }
}
