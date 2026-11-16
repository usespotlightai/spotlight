import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class JudgeClaimsPullRequestVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(revisionId: string) {
    super(
      `Judge claims pull request of revision ${revisionId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'JudgeClaimsPullRequestVersionConflictError';
  }
}
