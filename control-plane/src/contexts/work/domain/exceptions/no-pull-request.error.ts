import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NoPullRequestError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(taskId: string) {
    super(`Task ${taskId} has no pull request.`);
    this.name = 'NoPullRequestError';
  }
}
