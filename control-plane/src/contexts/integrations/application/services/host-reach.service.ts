import type { HeldSecretsPort } from '@configuration/application/ports/held-secrets.port';
import type { Reach } from '@integrations/application/ports/integration-runtime.port';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class HostReach {
  constructor(
    private readonly secrets: HeldSecretsPort,
    private readonly connections: HostConnectionRepository,
  ) {}

  async of(teamId: TeamId, integration: Integration): Promise<Reach> {
    integration.assertReachableWith(await this.secrets.held(teamId));

    const connection = integration.connects
      ? await this.connections.of(teamId, integration.source)
      : null;

    return { connection: connection?.accessToken ?? null };
  }
}
