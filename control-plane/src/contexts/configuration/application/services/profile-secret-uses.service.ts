import type { HarnessProfileRepository } from '@configuration/domain/repositories/harness-profile.repository';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  NamedSecret,
  SecretUser,
} from '@secrets/application/ports/secret-uses.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ProfileSecretUses implements SecretUser {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly profiles: HarnessProfileRepository,
  ) {}

  async usesOf(secret: NamedSecret): Promise<readonly string[]> {
    const name = SecretName.of(secret.name);
    const uses: string[] = [];

    for (const team of await this.teams.inWorkspace(
      WorkspaceId.of(secret.workspaceId),
    )) {
      for (const profile of await this.profiles.ofTeam(team.id)) {
        if (!profile.isRetired && profile.settings.uses(name)) {
          uses.push(
            `harness profile ${TeamAddress.of(team.key, profile.key.value)}`,
          );
        }
      }
    }

    return uses;
  }
}
