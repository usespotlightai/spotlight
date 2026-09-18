import { integrationFilesIn } from '@configuration/application/contracts/configuration-layout.contract';
import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class RefreshConnections {
  constructor(
    private readonly connections: HostConnectionRepository,
    private readonly configurations: AppliedConfigurationPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async refresh(): Promise<void> {
    const now = this.clock.now();
    const expiring = await this.connections.expiringBefore(
      HostConnection.renewalHorizon(now),
    );

    for (const connection of expiring) {
      if (!connection.needsRenewal(now)) {
        continue;
      }

      try {
        await this.one(connection, now);
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

  private async one(connection: HostConnection, now: Date): Promise<void> {
    const refreshToken = connection.refreshToken;
    const applied = await this.configurations.of(connection.teamId);

    if (!refreshToken || !applied) {
      return;
    }

    const renewed = await this.runtime.renew(
      integrationFilesIn(applied.files),
      connection.source,
      refreshToken,
    );

    if (renewed.kind === 'refused') {
      this.log.warn(
        {
          team: connection.teamId.value,
          source: connection.source.value,
        },
        'A host refused to renew a connection',
      );
      await this.connections.save(connection.renewalRefused(now));
    }

    if (renewed.kind === 'renewed') {
      await this.connections.save(connection.renewedWith(renewed.grant));
    }
  }
}
