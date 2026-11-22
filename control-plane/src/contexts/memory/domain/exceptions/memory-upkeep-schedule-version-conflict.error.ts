import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryUpkeepScheduleVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `The memory upkeep schedule of team ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'MemoryUpkeepScheduleVersionConflictError';
  }
}
