import type {
  HeldKind,
  HeldResourceConfigurationDto,
} from '@configuration/application/dto/held-configuration.dto';
import type { HarnessProfileResourcesPort } from '@configuration/application/ports/harness-profile-resources.port';
import type { HookConfigsPort } from '@configuration/application/ports/hook-configs.port';
import type { IntegrationConfigsPort } from '@configuration/application/ports/integration-configs.port';
import type { SkillResourcesPort } from '@configuration/application/ports/skill-resources.port';
import type { ResourceConfigurationQuery } from '@configuration/application/queries/resource-configuration.query';
import type { HeldConfigurations } from '@configuration/application/services/held-configurations.service';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { TokenTrustConfigurationPort } from '@identity/application/ports/token-trust-configuration.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { RunnerConfigurationPort } from '@runners/application/ports/runner-configuration.port';
import type { SecretConfigurationPort } from '@secrets/application/ports/secret-configuration.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineResourcesPort } from '@work/application/ports/line-resources.port';

interface OnTeam {
  readonly teamId: TeamId;
}

interface InWorkspace {
  readonly workspaceId: WorkspaceId;
}

export class ResourceConfigurationHandler
  implements
    QueryHandlerPort<
      ResourceConfigurationQuery,
      HeldResourceConfigurationDto | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly teams: TeamDirectoryPort,
    private readonly lines: LineResourcesPort,
    private readonly skills: SkillResourcesPort,
    private readonly integrations: IntegrationConfigsPort,
    private readonly hooks: HookConfigsPort,
    private readonly profiles: HarnessProfileResourcesPort,
    private readonly secrets: SecretConfigurationPort,
    private readonly runners: RunnerConfigurationPort,
    private readonly tokenTrusts: TokenTrustConfigurationPort,
    private readonly held: HeldConfigurations,
  ) {}

  async execute(
    query: ResourceConfigurationQuery,
  ): Promise<HeldResourceConfigurationDto | null> {
    try {
      const workspaceId = await this.workspaceOf(query.kind, query.id);
      const permissions =
        workspaceId &&
        (await this.access.permissionsIn(workspaceId, query.principal));
      const workspace =
        permissions &&
        (await this.workspaces.profileOf(permissions.workspaceId.value));

      if (!workspace) {
        return null;
      }

      const configuration = await this.held.of(workspace);
      const resource = configuration.resources.find(
        (each) => each.kind === query.kind && each.id === query.id,
      );

      return resource ? { configuration, resource } : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async workspaceOf(
    kind: HeldKind,
    id: string,
  ): Promise<WorkspaceId | null> {
    switch (kind) {
      case 'workspace':
        return WorkspaceId.of(id);
      case 'team':
        return this.teamWorkspaceOf({ teamId: TeamId.of(id) });
      case 'line':
        return this.teamWorkspaceOf(await this.lines.withId(id));
      case 'skill':
        return this.teamWorkspaceOf(await this.skills.withId(id));
      case 'integration':
        return this.teamWorkspaceOf(await this.integrations.withId(id));
      case 'hook':
        return this.teamWorkspaceOf(await this.hooks.withId(id));
      case 'harness-profile':
        return this.teamWorkspaceOf(await this.profiles.withId(id));
      case 'secret':
        return workspaceOfHeld(await this.secrets.withId(id));
      case 'workspace-token-trust':
        return workspaceOfHeld(await this.tokenTrusts.withId(id));
      case 'runner-trust':
        return workspaceOfHeld(await this.runners.trustWithId(id));
      case 'runner-pool':
        return workspaceOfHeld(await this.runners.poolWithId(id));
      case 'egress':
        return workspaceOfHeld(await this.runners.egressWithId(id));
      case 'workspace-runners':
        return workspaceOfHeld(await this.runners.declaredWithId(id));
    }
  }

  private async teamWorkspaceOf(
    held: OnTeam | null,
  ): Promise<WorkspaceId | null> {
    return held
      ? ((await this.teams.find(held.teamId))?.workspaceId ?? null)
      : null;
  }
}

const workspaceOfHeld = (held: InWorkspace | null): WorkspaceId | null =>
  held?.workspaceId ?? null;
