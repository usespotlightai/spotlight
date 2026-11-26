import type { PlatformSetup } from '@runners/application/ports/platform-setup.port';
import type { RunnerReadinessPort } from '@runners/application/ports/runner-readiness.port';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import {
  type PlatformProvisioning,
  type WorkspaceRunnerFacts,
  WorkspaceReadiness,
} from '@runners/domain/services/workspace-readiness';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerReadiness implements RunnerReadinessPort {
  private readonly platform: PlatformProvisioning;

  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly hosts: RunnerHostRepository,
    private readonly clock: ClockPort,
    setup: Pick<PlatformSetup, 'platformPoolSet' | 'platformEgressSet'>,
  ) {
    this.platform = {
      poolSet: setup.platformPoolSet,
      egressSet: setup.platformEgressSet,
    };
  }

  async readyToRun(workspaceId: WorkspaceId): Promise<boolean> {
    return WorkspaceReadiness.readyToRun(await this.factsOf(workspaceId));
  }

  async hasEgressCapableRunner(workspaceId: WorkspaceId): Promise<boolean> {
    return WorkspaceReadiness.readyForEgress(await this.factsOf(workspaceId));
  }

  async hasPlatformRunners(workspaceId: WorkspaceId): Promise<boolean> {
    return WorkspaceReadiness.hasPlatformRunners({
      pools: await this.pools.inWorkspace(workspaceId),
      platform: this.platform,
    });
  }

  private async factsOf(
    workspaceId: WorkspaceId,
  ): Promise<WorkspaceRunnerFacts> {
    // One after the other: inside a transaction, as when an event handler asks, both repositories share one pg client, which refuses a second query while it runs one.
    const pools = await this.pools.inWorkspace(workspaceId);
    const hosts = await this.hosts.inWorkspace(workspaceId);

    return { pools, hosts, platform: this.platform, now: this.clock.now() };
  }
}
