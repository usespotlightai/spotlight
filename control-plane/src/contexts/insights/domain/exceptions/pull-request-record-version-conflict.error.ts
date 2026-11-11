import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class PullRequestRecordVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(pullRequest: string) {
    super(
      `Record of pull request ${pullRequest} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'PullRequestRecordVersionConflictError';
  }
}
