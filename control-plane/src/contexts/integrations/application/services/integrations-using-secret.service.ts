import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class IntegrationsUsingSecret {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
  ) {}

  async of(
    workspaceId: WorkspaceId,
    secret: SecretName,
  ): Promise<readonly IntegrationAddress[]> {
    const addresses: IntegrationAddress[] = [];

    for (const team of await this.teams.inWorkspace(workspaceId)) {
      for (const integration of this.runtime.integrations(
        await this.defined.ofTeam(team.id),
      )) {
        if (integration.usesSecret(secret)) {
          addresses.push(IntegrationAddress.of(team.key, integration.key));
        }
      }
    }

    return addresses;
  }
}
