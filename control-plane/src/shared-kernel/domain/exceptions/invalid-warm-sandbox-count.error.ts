import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWarmSandboxCountError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Warm sandboxes ${because}.`);
    this.name = 'InvalidWarmSandboxCountError';
  }
}
