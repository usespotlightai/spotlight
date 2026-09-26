import type {
  HeldConfigurationDto,
  HeldResourceDto,
} from '@configuration/application/dto/held-configuration.dto';
import { HeldResourceMapper } from '@configuration/application/mappers/held-resource.mapper';
import type { HarnessProfileResourcesPort } from '@configuration/application/ports/harness-profile-resources.port';
import type { HeldHooksPort } from '@configuration/application/ports/held-hooks.port';
import type { HeldIntegrationsPort } from '@configuration/application/ports/held-integrations.port';
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

export class HeldConfigurations {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly lines: LineResourcesPort,
    private readonly skills: SkillResourcesPort,
    private readonly integrations: HeldIntegrationsPort,
    private readonly hooks: HeldHooksPort,
    private readonly profiles: HarnessProfileResourcesPort,
    private readonly profileViews: HarnessProfileViews,
    private readonly secrets: SecretConfigurationPort,
    private readonly runners: RunnerConfigurationPort,
    private readonly tokenTrusts: TokenTrustConfigurationPort,
  ) {}

  async of(workspace: WorkspaceProfile): Promise<HeldConfigurationDto> {
    const workspaceId = WorkspaceId.of(workspace.id);
    const [teams, secrets, runners, tokenTrusts] = await Promise.all([
      this.teams.inWorkspace(workspaceId),
      this.secrets.in(workspaceId),
      this.runners.in(workspaceId),
      this.tokenTrusts.in(workspaceId),
    ]);
    const heldByTeams = await Promise.all(
      teams.map((team) => this.heldBy(team)),
    );

    return {
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      resources: [
        HeldResourceMapper.workspace(workspace),
        ...secrets.map(HeldResourceMapper.secret),
        ...tokenTrusts.map(HeldResourceMapper.tokenTrust),
        ...runners.trusts.map(HeldResourceMapper.trust),
        ...runners.pools.map(HeldResourceMapper.pool),
        ...(runners.declared
          ? [HeldResourceMapper.declared(runners.declared)]
          : []),
        ...heldByTeams.flat(),
      ],
    };
  }

  private async heldBy(team: TeamProfile): Promise<readonly HeldResourceDto[]> {
    const [lines, skills, integrations, hooks, profiles] = await Promise.all([
      this.lines.ofTeam(team.id),
      this.skills.ofTeam(team.id),
      this.integrations.ofTeam(team.id),
      this.hooks.ofTeam(team.id),
      this.profiles.ofTeam(team.id),
    ]);

    return [
      HeldResourceMapper.team(team),
      ...lines.map((each) => HeldResourceMapper.line(team.key, each)),
      ...skills.map((each) => HeldResourceMapper.skill(team.key, each)),
      ...integrations.map((each) =>
        HeldResourceMapper.integration(team.key, each),
      ),
      ...hooks.map((each) => HeldResourceMapper.hook(team.key, each)),
      ...profiles.map((each) =>
        HeldResourceMapper.profile(
          team.key,
          this.profileViews.onTeam(each, team.key),
        ),
      ),
    ];
  }
}
