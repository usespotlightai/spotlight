import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidToolUseError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(rule: string) {
    super(`A run's tool use ${rule}`);
    this.name = 'InvalidToolUseError';
  }
}
