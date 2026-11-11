import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunnerLabelError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Runner label ${because}.`);
    this.name = 'InvalidRunnerLabelError';
  }
}
