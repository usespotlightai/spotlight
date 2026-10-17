import type { SecretNamesPort } from '@configuration/application/ports/secret-names.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { DefinedSecretsPort } from '@secrets/application/ports/defined-secrets.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class WorkspaceSecrets implements SecretNamesPort {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly secrets: DefinedSecretsPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<readonly SecretName[]> {
    const team = await this.teams.find(teamId);

    return team
      ? (await this.secrets.namesIn(team.workspaceId.value)).map((name) =>
          SecretName.of(name),
        )
      : [];
  }
}
