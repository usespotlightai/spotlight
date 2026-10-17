import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type {
  IntegrationRuntimePort,
  Renewed,
} from '@integrations/application/ports/integration-runtime.port';
import type { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { HostConnectionVersionConflictError } from '@integrations/domain/exceptions/host-connection-version-conflict.error';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const RENEWAL_LEASE_MS = 30_000;

const WATCH_EVERY_MS = 250;

const WATCHES = RENEWAL_LEASE_MS / WATCH_EVERY_MS;

const SETTLES = 3;

export type Wait = (ms: number) => Promise<void>;

const waiting: Wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class ConnectionRenewal {
  constructor(
    private readonly connections: HostConnectionRepository,
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly clock: ClockPort,
    private readonly wait: Wait = waiting,
  ) {}

  async afterRefusal(
    teamId: TeamId,
    source: SourceKey,
    holder: ConnectionHolder,
    refused: AccessToken,
  ): Promise<AccessToken | null> {
    for (let round = 0; round <= WATCHES; round++) {
      const found = await this.connections.of(teamId, source, holder);

      if (!found?.usable) {
        return null;
      }

      if (!found.refusedToken(refused)) {
        return found.accessToken;
      }

      if (!found.renewable) {
        return null;
      }

      const now = this.clock.now();

      if (found.isClaimedAt(now)) {
        await this.wait(WATCH_EVERY_MS);
        continue;
      }

      const claimed = await this.claimed(found, now);

      if (claimed) {
        return this.renewing(claimed);
      }
    }

    return null;
  }

  async ahead(connection: HostConnection): Promise<Renewed['kind'] | null> {
    const now = this.clock.now();

    if (!connection.needsRenewal(now)) {
      return null;
    }

    const claimed = await this.claimed(connection, now);

    if (!claimed) {
      return null;
    }

    const renewed = await this.renewed(claimed);

    return renewed.kind;
  }

  private async claimed(
    connection: HostConnection,
    now: Date,
  ): Promise<HostConnection | null> {
    const claimed = connection.claimRenewal(now, RENEWAL_LEASE_MS);

    try {
      await this.connections.save(claimed);
    } catch (error) {
      if (error instanceof HostConnectionVersionConflictError) {
        return null;
      }

      throw error;
    }

    const current = await this.connections.of(
      claimed.teamId,
      claimed.source,
      claimed.holder,
    );
    const claim = claimed.renewalClaim;

    return claim && current?.renewalClaim?.equals(claim) ? current : null;
  }

  private async renewing(claimed: HostConnection): Promise<AccessToken | null> {
    const renewed = await this.renewed(claimed);

    return renewed.kind === 'renewed' ? renewed.grant.accessToken : null;
  }

  private async renewed(claimed: HostConnection): Promise<Renewed> {
    const refreshToken = claimed.refreshToken;

    if (!refreshToken) {
      return { kind: 'unrenewable' };
    }

    let renewed: Renewed;

    try {
      renewed = await this.runtime.renew(
        await this.defined.ofTeam(claimed.teamId),
        claimed.teamId,
        claimed.source,
        refreshToken,
      );
    } catch (error) {
      await this.settle(claimed, refreshToken, (current) =>
        current.renewalReleased(),
      );
      throw error;
    }

    const at = this.clock.now();

    if (renewed.kind === 'renewed') {
      await this.settle(claimed, refreshToken, (current) =>
        current.renewedWith(renewed.grant),
      );
    }

    if (renewed.kind === 'refused') {
      await this.settle(claimed, refreshToken, (current) =>
        current.renewalRefused(at),
      );
    }

    if (renewed.kind === 'unrenewable') {
      await this.settle(claimed, refreshToken, (current) =>
        current.renewalReleased(),
      );
    }

    return renewed;
  }

  private async settle(
    claimed: HostConnection,
    used: AccessToken,
    change: (current: HostConnection) => HostConnection,
  ): Promise<void> {
    let current: HostConnection | null = claimed;

    for (let attempt = 1; current; attempt++) {
      try {
        await this.connections.save(change(current));
        return;
      } catch (error) {
        if (
          !(error instanceof HostConnectionVersionConflictError) ||
          attempt >= SETTLES
        ) {
          throw error;
        }
      }

      const reloaded = await this.connections.of(
        claimed.teamId,
        claimed.source,
        claimed.holder,
      );

      current = reloaded?.refreshToken?.equals(used) ? reloaded : null;
    }
  }
}
