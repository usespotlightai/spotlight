import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidJudgeClaimsPullRequestError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Judge claims pull request ${reason}.`);
    this.name = 'InvalidJudgeClaimsPullRequestError';
  }
}
