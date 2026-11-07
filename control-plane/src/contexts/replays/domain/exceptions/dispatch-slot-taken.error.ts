import type { DispatchPool } from '@replays/domain/value-objects/dispatch-pool.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class DispatchSlotTakenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(pool: DispatchPool) {
    super(
      `A run slot of dispatch pool ${pool.value} was taken by another replay. Please try again.`,
    );
    this.name = 'DispatchSlotTakenError';
  }
}
