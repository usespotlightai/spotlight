import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidFailureCauseError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: 'cause' | 'evidence' | 'suggestion',
    readonly reason: string,
  ) {
    super(`A cause’s ${field} ${reason}`);
    this.name = 'InvalidFailureCauseError';
  }
}
