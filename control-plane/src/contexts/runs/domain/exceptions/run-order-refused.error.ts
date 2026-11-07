import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunOrderRefusedError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'RunOrderRefusedError';
  }
}
