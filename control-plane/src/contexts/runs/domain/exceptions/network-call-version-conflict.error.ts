import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NetworkCallVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Network call ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'NetworkCallVersionConflictError';
  }
}
