import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryUpkeepVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Memory upkeep ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'MemoryUpkeepVersionConflictError';
  }
}
