import type { ClockPort } from '@application/ports/clock.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { HostConnection } from '@domain/aggregates/host-connection.aggregate';
import type { HostConnectionRepository } from '@domain/repositories/host-connection.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { OAuth2Clients } from '@infrastructure/integrations/oauth2-clients';
import { oauth2Of } from '@infrastructure/integrations/oauth2-config';
import type { OAuth2Exchange } from '@infrastructure/integrations/oauth2-exchange';

const AHEAD_MS = 5 * 60 * 1000;

export class RefreshConnections {
  constructor(
    private readonly connections: HostConnectionRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: IntegrationReader,
    private readonly clients: OAuth2Clients,
    private readonly exchange: OAuth2Exchange,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async refresh(): Promise<void> {
    const before = new Date(this.clock.now().getTime() + AHEAD_MS);

    for (const connection of await this.connections.nearingExpiry(before)) {
      try {
        await this.one(connection);
      } catch (error) {
        this.log.warn(
          {
            err: error,
            team: connection.teamId.value,
            source: connection.source.value,
          },
          'Renewing a host connection',
        );
      }
    }
  }

  private async one(connection: HostConnection): Promise<void> {
    if (!connection.refreshToken) {
      return;
    }

    const oauth2 = await oauth2Of(
      this.configurations,
      this.reader,
      connection.teamId,
      connection.source.value,
    );
    const client = this.clients.of(connection.source.value);

    if (!oauth2 || !client) {
      return;
    }

    const grant = await this.exchange.refresh(
      oauth2,
      client,
      connection.refreshToken,
    );

    if (!grant) {
      this.log.warn(
        {
          team: connection.teamId.value,
          source: connection.source.value,
        },
        'A host refused to renew a connection',
      );
      return;
    }

    await this.connections.save(connection.renewedWith(grant));
  }
}
