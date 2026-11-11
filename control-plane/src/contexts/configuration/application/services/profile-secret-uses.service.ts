import type { HarnessProfileResourcesPort } from '@configuration/application/ports/harness-profile-resources.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  NamedSecret,
  SecretUse,
  SecretUser,
} from '@secrets/application/ports/secret-uses.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ProfileSecretUses implements SecretUser {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly profiles: HarnessProfileResourcesPort,
  ) {}

  async usesOf(secret: NamedSecret): Promise<readonly SecretUse[]> {
    const name = SecretName.of(secret.name);
    const uses: SecretUse[] = [];

    for (const team of await this.teams.inWorkspace(
      WorkspaceId.of(secret.workspaceId),
    )) {
      for (const profile of await this.profiles.ofTeam(team.id)) {
        if (profile.settings.uses(name)) {
          uses.push({
            kind: 'harness-profile',
            key: TeamAddress.of(team.key, profile.key.value).toString(),
          });
        }
      }
    }

    return uses;
  }
}
