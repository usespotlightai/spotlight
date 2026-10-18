import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { poolsNaming } from '@runners/domain/services/egress-uses';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteRunnersOfDeletedWorkspace {
  constructor(
    private readonly trusts: RunnerTrustRepository,
    private readonly declarations: WorkspaceRunnersRepository,
    private readonly pools: RunnerPoolRepository,
    private readonly egresses: EgressRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async trustsOf(workspaceId: WorkspaceId): Promise<void> {
    const by = ChangeActor.spotlight(workspaceId);

    for (const trust of await this.trusts.inWorkspace(workspaceId)) {
      await this.transaction.inTransaction(() =>
        this.trusts.save(trust.delete(by)),
      );
    }
  }

  async poolsOf(workspaceId: WorkspaceId): Promise<void> {
    const by = ChangeActor.spotlight(workspaceId);

    for (const pool of await this.pools.inWorkspace(workspaceId)) {
      await this.transaction.inTransaction(() =>
        this.pools.save(pool.delete(by)),
      );
    }
  }

  async egressesOf(workspaceId: WorkspaceId): Promise<void> {
    const by = ChangeActor.spotlight(workspaceId);
    const pools = await this.pools.inWorkspace(workspaceId);

    for (const egress of await this.egresses.inWorkspace(workspaceId)) {
      await this.transaction.inTransaction(() =>
        this.egresses.save(egress.delete(poolsNaming(egress, pools), by)),
      );
    }
  }

  async declarationOf(workspaceId: WorkspaceId): Promise<void> {
    const declared = await this.declarations.declaredIn(workspaceId);

    if (declared) {
      await this.transaction.inTransaction(() =>
        this.declarations.save(
          declared.delete(ChangeActor.spotlight(workspaceId)),
        ),
      );
    }
  }
}
