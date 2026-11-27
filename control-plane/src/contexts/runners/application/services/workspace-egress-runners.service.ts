import type { PlatformSetup } from '@runners/application/ports/platform-setup.port';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { injectsSecrets } from '@runners/domain/services/injects-secrets';
import type { EgressRunnerSource } from '@secrets/application/ports/egress-runners.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceEgressRunners implements EgressRunnerSource {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly setup: Pick<
      PlatformSetup,
      'platformPoolSet' | 'platformEgressSet'
    >,
  ) {}

  async anyIn(workspaceId: string): Promise<boolean> {
    const id = WorkspaceId.of(workspaceId);
    const [pools, trusts] = await Promise.all([
      this.pools.inWorkspace(id),
      this.trusts.inWorkspace(id),
    ]);

    return injectsSecrets(pools, trusts, this.setup);
  }
}
