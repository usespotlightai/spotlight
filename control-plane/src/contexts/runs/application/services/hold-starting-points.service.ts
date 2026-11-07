import type { ArchiveReferenceLocksPort } from '@runs/application/ports/archive-reference-locks.port';
import type { StartingPointHoldsPort } from '@runs/application/ports/starting-point-holds.port';
import { StartingPointHold } from '@runs/domain/aggregates/starting-point-hold.aggregate';
import type { StartingPointHoldRepository } from '@runs/domain/repositories/starting-point-hold.repository';
import { HoldHolder } from '@runs/domain/value-objects/hold-holder.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HoldStartingPoints implements StartingPointHoldsPort {
  constructor(
    private readonly holds: StartingPointHoldRepository,
    private readonly transaction: TransactionPort,
    private readonly locks: ArchiveReferenceLocksPort,
  ) {}

  hold(
    holder: string,
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<void> {
    const runs = runIds.map((each) => RunId.of(each));
    const named = HoldHolder.of(holder);
    const workspace = WorkspaceId.of(workspaceId);

    return this.locks.referencing(workspace, async () => {
      const held = await this.holds.find(named);

      if (held) {
        await this.holds.save(held.holding(runs, workspace));
        return;
      }

      await this.holds.add(StartingPointHold.take(named, workspace, runs));
    });
  }

  release(holder: string): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const held = await this.holds.find(HoldHolder.of(holder));

      if (held) {
        await this.holds.save(held.released());
      }
    });
  }
}
