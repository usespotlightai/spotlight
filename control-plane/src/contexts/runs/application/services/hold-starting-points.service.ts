import type { StartingPointHoldsPort } from '@runs/application/ports/starting-point-holds.port';
import { StartingPointHold } from '@runs/domain/aggregates/starting-point-hold.aggregate';
import type { StartingPointHoldRepository } from '@runs/domain/repositories/starting-point-hold.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HoldStartingPoints implements StartingPointHoldsPort {
  constructor(
    private readonly holds: StartingPointHoldRepository,
    private readonly transaction: TransactionPort,
  ) {}

  hold(
    holder: string,
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<void> {
    const runs = runIds.map((each) => RunId.of(each));

    return this.transaction.inTransaction(async () => {
      const held = await this.holds.find(holder);

      if (held) {
        await this.holds.save(held.holding(runs));
        return;
      }

      if (runs.length > 0) {
        await this.holds.add(
          StartingPointHold.take(holder, WorkspaceId.of(workspaceId)).holding(
            runs,
          ),
        );
      }
    });
  }

  release(holder: string): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const held = await this.holds.find(holder);

      if (held) {
        await this.holds.save(held.released());
      }
    });
  }
}
