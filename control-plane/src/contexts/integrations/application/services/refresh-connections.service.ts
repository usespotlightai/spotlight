import type { ConnectionRefresh } from '@integrations/application/services/connection-refresh.service';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class RefreshConnections {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly connectionRefresh: ConnectionRefresh,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async refresh(): Promise<void> {
    const now = this.clock.now();
    const expiring = await this.connections.expiringBefore(
      IntegrationConnection.refreshHorizon(now),
    );

    for (const connection of expiring) {
      const about = {
        team: connection.teamId.value,
        integration: connection.integration.value,
        owner: connection.owner.key,
      };

      try {
        const result = await this.connectionRefresh.ahead(connection);

        if (result === 'failed') {
          this.log.warn(about, 'The integration did not refresh a connection');
        }

        if (result === 'other-client') {
          this.log.info(
            about,
            'Did not refresh a connection made through another OAuth client',
          );
        }
      } catch (error) {
        this.log.warn(
          { err: error, ...about },
          'Refreshing an integration connection',
        );
      }
    }
  }
}
