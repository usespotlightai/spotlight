import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidConfigPullRequestError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Config pull request ${reason}.`);
    this.name = 'InvalidConfigPullRequestError';
  }
}
