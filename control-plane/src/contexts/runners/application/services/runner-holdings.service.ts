import type { WorkspaceHolder } from '@identity/application/ports/workspace-holdings.port';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerHoldings implements WorkspaceHolder {
  constructor(
    private readonly trusts: RunnerTrustRepository,
    private readonly declarations: WorkspaceRunnersRepository,
    private readonly pools: RunnerPoolRepository,
    private readonly egresses: EgressRepository,
  ) {}

  async heldBy(workspaceId: WorkspaceId): Promise<readonly string[]> {
    const [trusts, declared, pools, egresses] = await Promise.all([
      this.trusts.inWorkspace(workspaceId),
      this.declarations.declaredIn(workspaceId),
      this.pools.inWorkspace(workspaceId),
      this.egresses.inWorkspace(workspaceId),
    ]);

    return [
      ...trusts.map((each) => `runner trust ${each.key.value}`),
      ...pools.map((each) => `runner pool ${each.key.value}`),
      ...egresses.map((each) => `egress ${each.key.value}`),
      ...(declared ? ['workspace runners'] : []),
    ];
  }
}
