import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type {
  EgressView,
  RunnerConfigurationPort,
  RunnerPoolView,
  RunnersView,
  RunnerTrustView,
  WorkspaceRunnersView,
} from '@runners/application/ports/runner-configuration.port';
import type { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
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
    private readonly egresses: EgressRepository,
  ) {}

  async in(workspaceId: WorkspaceId): Promise<RunnersView> {
    const [trusts, declared, pools, egresses] = await Promise.all([
      this.trusts.inWorkspace(workspaceId),
      this.declarations.declaredIn(workspaceId),
      this.pools.inWorkspace(workspaceId),
      this.egresses.inWorkspace(workspaceId),
    ]);

    return {
      trusts: trusts.map(RunnerResourceMapper.configuredTrust),
      pools: pools.map(RunnerResourceMapper.configuredPool),
      egresses: egresses.map(RunnerResourceMapper.configuredEgress),
      declared: declared ? await this.declaration(declared) : null,
    };
  }

  async trustWithId(id: string): Promise<RunnerTrustView | null> {
    const trust = await this.trusts.find(RunnerTrustId.of(id));

    return trust ? RunnerResourceMapper.configuredTrust(trust) : null;
  }

  async poolWithId(id: string): Promise<RunnerPoolView | null> {
    const pool = await this.pools.find(RunnerPoolId.of(id));

    return pool ? RunnerResourceMapper.configuredPool(pool) : null;
  }

  async egressWithId(id: string): Promise<EgressView | null> {
    const egress = await this.egresses.find(EgressId.of(id));

    return egress ? RunnerResourceMapper.configuredEgress(egress) : null;
  }

  async declaredWithId(id: string): Promise<WorkspaceRunnersView | null> {
    const declared = await this.declarations.find(WorkspaceRunnersId.of(id));

    return declared ? this.declaration(declared) : null;
  }

  private async declaration(
    declared: WorkspaceRunners,
  ): Promise<WorkspaceRunnersView | null> {
    const slug = await this.workspaces.slugOf(declared.workspaceId.value);

    return slug
      ? RunnerResourceMapper.configuredDeclaration(declared, slug)
      : null;
  }
}
