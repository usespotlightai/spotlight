import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidAgentConfigFilterError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Agent config filter ${reason}.`);
    this.name = 'InvalidAgentConfigFilterError';
  }
}
