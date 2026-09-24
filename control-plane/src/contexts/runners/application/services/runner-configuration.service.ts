import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type {
  ConfiguredRunner,
  ConfiguredRunners,
  ConfiguredRunnerTrust,
  ConfiguredWorkspaceRunners,
  RunnerConfigurationPort,
} from '@runners/application/ports/runner-configuration.port';
import type { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerConfiguration implements RunnerConfigurationPort {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly declarations: WorkspaceRunnersRepository,
    private readonly workspaces: WorkspaceReaderPort,
  ) {}

  async in(workspaceId: WorkspaceId): Promise<ConfiguredRunners> {
    const [runners, trusts, declared] = await Promise.all([
      this.runners.standingIn(workspaceId),
      this.trusts.inWorkspace(workspaceId),
      this.declarations.declaredIn(workspaceId),
    ]);

    return {
      runners: runners
        .filter((each) => each.holdsWorkspace)
        .map(RunnerResourceMapper.configuredRunner),
      trusts: trusts.map(RunnerResourceMapper.configuredTrust),
      declared: declared ? await this.declaration(declared) : null,
    };
  }

  async runnerWithId(id: string): Promise<ConfiguredRunner | null> {
    const runner = await this.runners.find(RunnerId.of(id));

    return runner?.holdsWorkspace
      ? RunnerResourceMapper.configuredRunner(runner)
      : null;
  }

  async trustWithId(id: string): Promise<ConfiguredRunnerTrust | null> {
    const trust = await this.trusts.find(RunnerTrustId.of(id));

    return trust ? RunnerResourceMapper.configuredTrust(trust) : null;
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
