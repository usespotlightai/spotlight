import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class PushDiffStateConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(`A push diff ${reason}.`);
    this.name = 'PushDiffStateConflictError';
  }
}
