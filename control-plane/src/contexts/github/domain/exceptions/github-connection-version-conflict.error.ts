import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class GitHubConnectionVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor() {
    super(
      'GitHub connection changed since you loaded it. Please reload and try again.',
    );
    this.name = 'GitHubConnectionVersionConflictError';
  }
}
