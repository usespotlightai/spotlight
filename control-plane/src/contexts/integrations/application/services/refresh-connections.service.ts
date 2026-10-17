import type { ConnectionRenewal } from '@integrations/application/services/connection-renewal.service';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class RefreshConnections {
  constructor(
    private readonly connections: HostConnectionRepository,
    private readonly renewal: ConnectionRenewal,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async refresh(): Promise<void> {
    const now = this.clock.now();
    const expiring = await this.connections.expiringBefore(
      HostConnection.renewalHorizon(now),
    );

    for (const connection of expiring) {
      const about = {
        team: connection.teamId.value,
        source: connection.source.value,
        holder: connection.holder.key,
      };

      try {
        if ((await this.renewal.ahead(connection)) === 'failed') {
          this.log.warn(about, 'A host did not renew a connection');
        }
      } catch (error) {
        this.log.warn({ err: error, ...about }, 'Renewing a host connection');
      }
    }
  }
}
