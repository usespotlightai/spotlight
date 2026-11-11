import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import {
  MemoryUses,
  type UsingRun,
} from '@memory/domain/entities/memory-uses.entity';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUse } from '@memory/domain/value-objects/memory-use';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class RecordMemoryUses {
  constructor(
    private readonly uses: MemoryUsesPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async recorded(
    run: UsingRun,
    via: MemoryUse,
    memories: readonly MemoryId[],
  ): Promise<void> {
    const recorded = MemoryUses.of({
      run,
      via,
      memories,
      at: this.clock.now(),
    });

    if (recorded) {
      await this.transaction.inTransaction(() => this.uses.record(recorded));
    }
  }
}
