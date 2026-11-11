import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHostAllowListError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly entry: string,
    readonly because: string,
  ) {
    super(`Allowed host "${entry}" ${because}.`);
    this.name = 'InvalidHostAllowListError';
  }
}
