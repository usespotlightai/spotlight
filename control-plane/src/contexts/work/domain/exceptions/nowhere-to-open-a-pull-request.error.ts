import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NowhereToOpenAPullRequestError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`The chat cannot open the pull request there: ${reason}`);
    this.name = 'NowhereToOpenAPullRequestError';
  }
}
