import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidPullRequestRecordError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A pull request record ${reason}.`);
    this.name = 'InvalidPullRequestRecordError';
  }
}
