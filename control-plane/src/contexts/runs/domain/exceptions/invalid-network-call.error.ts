import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidNetworkCallError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Network call ${reason}.`);
    this.name = 'InvalidNetworkCallError';
  }
}
