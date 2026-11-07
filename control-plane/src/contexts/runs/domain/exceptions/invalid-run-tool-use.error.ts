import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunToolUseError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(rule: string) {
    super(`A run's tool use ${rule}`);
    this.name = 'InvalidRunToolUseError';
  }
}
