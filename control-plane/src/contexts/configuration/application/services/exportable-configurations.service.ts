import type {
  ExportableConfigurationDto,
  ExportableResourceDto,
} from '@configuration/application/dto/exportable-configuration.dto';
import { ExportableResourceMapper } from '@configuration/application/mappers/exportable-resource.mapper';
import type { HarnessProfileResourcesPort } from '@configuration/application/ports/harness-profile-resources.port';
import type { HookConfigsPort } from '@configuration/application/ports/hook-configs.port';
import type { IntegrationConfigsPort } from '@configuration/application/ports/integration-configs.port';
import type { SkillResourcesPort } from '@configuration/application/ports/skill-resources.port';
import type { HarnessProfileViews } from '@configuration/application/services/harness-profile-views.service';
import type {
  TeamDirectoryPort,
  TeamProfile,
} from '@identity/application/ports/team-directory.port';
import type { TokenTrustConfigurationPort } from '@identity/application/ports/token-trust-configuration.port';
import type { WorkspaceProfile } from '@identity/application/ports/workspace-reader.port';
import type { RunnerConfigurationPort } from '@runners/application/ports/runner-configuration.port';
import type { SecretConfigurationPort } from '@secrets/application/ports/secret-configuration.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineResourcesPort } from '@work/application/ports/line-resources.port';

export class ExportableConfigurations {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly lines: LineResourcesPort,
    private readonly skills: SkillResourcesPort,
    private readonly integrations: IntegrationConfigsPort,
    private readonly hooks: HookConfigsPort,
    private readonly profiles: HarnessProfileResourcesPort,
    private readonly profileViews: HarnessProfileViews,
    private readonly secrets: SecretConfigurationPort,
    private readonly runners: RunnerConfigurationPort,
    private readonly tokenTrusts: TokenTrustConfigurationPort,
  ) {}

  async of(workspace: WorkspaceProfile): Promise<ExportableConfigurationDto> {
    const workspaceId = WorkspaceId.of(workspace.id);
    const [teams, secrets, runners, tokenTrusts] = await Promise.all([
      this.teams.inWorkspace(workspaceId),
      this.secrets.in(workspaceId),
      this.runners.in(workspaceId),
      this.tokenTrusts.in(workspaceId),
    ]);
    const teamScoped = await Promise.all(
      teams.map((team) => this.scopedTo(team)),
    );

    return {
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      resources: [
        ExportableResourceMapper.workspace(workspace),
        ...secrets.map(ExportableResourceMapper.secret),
        ...tokenTrusts.map(ExportableResourceMapper.tokenTrust),
        ...runners.trusts.map(ExportableResourceMapper.trust),
        ...runners.egresses.map(ExportableResourceMapper.egress),
        ...runners.pools.map(ExportableResourceMapper.pool),
        ...(runners.declared
          ? [ExportableResourceMapper.declared(runners.declared)]
          : []),
        ...teamScoped.flat(),
      ],
    };
  }

  private async scopedTo(
    team: TeamProfile,
  ): Promise<readonly ExportableResourceDto[]> {
    const [lines, skills, integrations, hooks, profiles] = await Promise.all([
      this.lines.ofTeam(team.id),
      this.skills.ofTeam(team.id),
      this.integrations.ofTeam(team.id),
      this.hooks.ofTeam(team.id),
      this.profiles.ofTeam(team.id),
    ]);

    return [
      ExportableResourceMapper.team(team),
      ...lines.map((each) => ExportableResourceMapper.line(team.key, each)),
      ...skills.map((each) => ExportableResourceMapper.skill(team.key, each)),
      ...integrations.map((each) =>
        ExportableResourceMapper.integration(team.key, each),
      ),
      ...hooks.map((each) => ExportableResourceMapper.hook(team.key, each)),
      ...profiles.map((each) =>
        ExportableResourceMapper.profile(
          team.key,
          this.profileViews.onTeam(each, team.key),
        ),
      ),
    ];
  }
}
