import type { SecretNamesPort } from '@configuration/application/ports/secret-names.port';
import { KnownSecrets } from '@configuration/domain/value-objects/known-secrets.vo';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { DefinedSecretsPort } from '@secrets/application/ports/defined-secrets.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const named = (names: readonly string[]): SecretName[] =>
  names.map((name) => SecretName.of(name));

export class WorkspaceSecrets implements SecretNamesPort {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly secrets: DefinedSecretsPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<readonly SecretName[]> {
    const team = await this.teams.find(teamId);

    return team
      ? named(await this.secrets.namesIn(team.workspaceId.value))
      : [];
  }

  async knownTo(teamId: TeamId): Promise<KnownSecrets> {
    const team = await this.teams.find(teamId);

    if (!team) {
      return KnownSecrets.of({ existing: [], allowedInSandbox: [] });
    }

    return KnownSecrets.of({
      existing: named(await this.secrets.namesIn(team.workspaceId.value)),
      allowedInSandbox: named(
        await this.secrets.namesInSandboxIn(team.workspaceId.value),
      ),
    });
  }
}
