import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Run ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunVersionConflictError';
  }
}
