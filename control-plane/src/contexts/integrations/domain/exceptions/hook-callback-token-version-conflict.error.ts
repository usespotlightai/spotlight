import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class HookCallbackTokenVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor() {
    super(
      'A hook callback token changed since it was loaded. Please try again.',
    );
    this.name = 'HookCallbackTokenVersionConflictError';
  }
}
