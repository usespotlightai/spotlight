import { reviseRunner } from '@runners/application/services/runner-revisions';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class AbandonWorkspaceRunners {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly declarations: WorkspaceRunnersRepository,
    private readonly pools: RunnerPoolRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async runnersOf(workspaceId: WorkspaceId): Promise<void> {
    const by = Attribution.spotlight(workspaceId);

    for (const each of await this.runners.standingIn(workspaceId)) {
      await reviseRunner(this.runners, each.id, (runner) =>
        runner.revoke(this.clock.now(), by),
      );
    }
  }

  async trustsOf(workspaceId: WorkspaceId): Promise<void> {
    const by = Attribution.spotlight(workspaceId);

    for (const trust of await this.trusts.inWorkspace(workspaceId)) {
      await this.transaction.run(() => this.trusts.save(trust.withdrawn(by)));
    }
  }

  async poolsOf(workspaceId: WorkspaceId): Promise<void> {
    const by = Attribution.spotlight(workspaceId);

    for (const pool of await this.pools.inWorkspace(workspaceId)) {
      await this.transaction.run(() => this.pools.save(pool.retired(by)));
    }
  }

  async declarationOf(workspaceId: WorkspaceId): Promise<void> {
    const declared = await this.declarations.declaredIn(workspaceId);

    if (declared) {
      await this.transaction.run(() =>
        this.declarations.save(
          declared.dropped(Attribution.spotlight(workspaceId)),
        ),
      );
    }
  }
}
