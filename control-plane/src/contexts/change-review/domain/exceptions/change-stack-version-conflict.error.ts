import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ChangeStackVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Change stack ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ChangeStackVersionConflictError';
  }
}
