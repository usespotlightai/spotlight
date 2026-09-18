import type { TeamSecretsPort } from '@configuration/application/ports/team-secrets.port';
import type { Reach } from '@integrations/application/ports/integration-runtime.port';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class HostReach {
  constructor(
    private readonly secrets: TeamSecretsPort,
    private readonly connections: HostConnectionRepository,
  ) {}

  async of(
    teamId: TeamId,
    integration: Pick<Integration, 'source' | 'credentials' | 'connects'>,
  ): Promise<Reach> {
    const [secret, connection] = await Promise.all([
      this.secrets.resolveAll(teamId, integration.credentials),
      integration.connects
        ? this.connections.of(teamId, integration.source)
        : Promise.resolve(null),
    ]);

    return { secret, connection: connection?.accessToken ?? null };
  }
}
