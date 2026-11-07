import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class DispatchVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`Dispatch of run ${id} changed meanwhile.`);
    this.name = 'DispatchVersionConflictError';
  }
}
