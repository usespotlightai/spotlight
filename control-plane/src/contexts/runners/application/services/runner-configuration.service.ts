import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type {
  ConfiguredRunnerPool,
  ConfiguredRunners,
  ConfiguredRunnerTrust,
  ConfiguredWorkspaceRunners,
  RunnerConfigurationPort,
} from '@runners/application/ports/runner-configuration.port';
import type { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerConfiguration implements RunnerConfigurationPort {
  constructor(
    private readonly trusts: RunnerTrustRepository,
    private readonly declarations: WorkspaceRunnersRepository,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly pools: RunnerPoolRepository,
  ) {}

  async in(workspaceId: WorkspaceId): Promise<ConfiguredRunners> {
    const [trusts, declared, pools] = await Promise.all([
      this.trusts.inWorkspace(workspaceId),
      this.declarations.declaredIn(workspaceId),
      this.pools.inWorkspace(workspaceId),
    ]);

    return {
      trusts: trusts.map(RunnerResourceMapper.configuredTrust),
      pools: pools.map(RunnerResourceMapper.configuredPool),
      declared: declared ? await this.declaration(declared) : null,
    };
  }

  async trustWithId(id: string): Promise<ConfiguredRunnerTrust | null> {
    const trust = await this.trusts.find(RunnerTrustId.of(id));

    return trust ? RunnerResourceMapper.configuredTrust(trust) : null;
  }

  async poolWithId(id: string): Promise<ConfiguredRunnerPool | null> {
    const pool = await this.pools.find(RunnerPoolId.of(id));

    return pool ? RunnerResourceMapper.configuredPool(pool) : null;
  }

  async declaredWithId(id: string): Promise<ConfiguredWorkspaceRunners | null> {
    const declared = await this.declarations.find(WorkspaceRunnersId.of(id));

    return declared ? this.declaration(declared) : null;
  }

  private async declaration(
    declared: WorkspaceRunners,
  ): Promise<ConfiguredWorkspaceRunners | null> {
    const slug = await this.workspaces.slugOf(declared.workspaceId.value);

    return slug
      ? RunnerResourceMapper.configuredDeclaration(declared, slug)
      : null;
  }
}
