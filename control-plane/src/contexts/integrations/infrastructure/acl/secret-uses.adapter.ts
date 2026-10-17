import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type {
  NamedSecret,
  SecretUser,
} from '@secrets/application/ports/secret-uses.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class IntegrationSecretUses implements SecretUser {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly reader: IntegrationReader,
  ) {}

  async usesOf(secret: NamedSecret): Promise<readonly string[]> {
    const uses: string[] = [];

    for (const team of await this.teams.inWorkspace(
      WorkspaceId.of(secret.workspaceId),
    )) {
      const { integrations } = this.reader.readable(
        await this.defined.ofTeam(team.id),
      );

      for (const { integration } of integrations) {
        if (
          integration.credentials.some((each) => each.value === secret.name)
        ) {
          uses.push(`integration ${team.key}/${integration.key.value}`);
        }
      }
    }

    return uses;
  }
}
