import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class HookFiringVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`Hook firing ${id} changed since it was loaded. Please try again.`);
    this.name = 'HookFiringVersionConflictError';
  }
}
