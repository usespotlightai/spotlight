import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type {
  IntegrationRuntimePort,
  RefreshResult,
} from '@integrations/application/ports/integration-runtime.port';
import type { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { IntegrationConnectionVersionConflictError } from '@integrations/domain/exceptions/integration-connection-version-conflict.error';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const REFRESH_LEASE_MS = 30_000;

const WATCH_EVERY_MS = 250;

const WATCHES = REFRESH_LEASE_MS / WATCH_EVERY_MS;

const MAX_SAVE_ATTEMPTS = 3;

export type Wait = (ms: number) => Promise<void>;

const waiting: Wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class ConnectionRefresh {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly clock: ClockPort,
    private readonly wait: Wait = waiting,
  ) {}

  async afterUnauthorized(
    teamId: TeamId,
    integration: IntegrationKey,
    owner: ConnectionOwner,
    unauthorizedToken: AccessToken,
  ): Promise<AccessToken | null> {
    for (let round = 0; round <= WATCHES; round++) {
      const found = await this.connections.of(teamId, integration, owner);

      if (!found?.usable) {
        return null;
      }

      if (!found.hasToken(unauthorizedToken)) {
        return found.accessToken;
      }

      if (!found.refreshable) {
        return null;
      }

      const now = this.clock.now();

      if (found.isClaimedAt(now)) {
        await this.wait(WATCH_EVERY_MS);
        continue;
      }

      const claimed = await this.claimed(found, now);

      if (claimed) {
        return this.refreshedToken(claimed);
      }
    }

    return null;
  }

  async ahead(
    connection: IntegrationConnection,
  ): Promise<RefreshResult['kind'] | null> {
    const now = this.clock.now();

    if (!connection.needsRefresh(now)) {
      return null;
    }

    const claimed = await this.claimed(connection, now);

    if (!claimed) {
      return null;
    }

    const result = await this.refreshClaimed(claimed);

    return result.kind;
  }

  private async claimed(
    connection: IntegrationConnection,
    now: Date,
  ): Promise<IntegrationConnection | null> {
    const claimed = connection.claimRefresh(now, REFRESH_LEASE_MS);

    try {
      await this.connections.save(claimed);
    } catch (error) {
      if (error instanceof IntegrationConnectionVersionConflictError) {
        return null;
      }

      throw error;
    }

    const current = await this.connections.of(
      claimed.teamId,
      claimed.integration,
      claimed.owner,
    );
    const claim = claimed.refreshClaim;

    return claim && current?.refreshClaim?.equals(claim) ? current : null;
  }

  private async refreshedToken(
    claimed: IntegrationConnection,
  ): Promise<AccessToken | null> {
    const result = await this.refreshClaimed(claimed);

    return result.kind === 'refreshed' ? result.tokens.accessToken : null;
  }

  private async refreshClaimed(
    claimed: IntegrationConnection,
  ): Promise<RefreshResult> {
    const refreshToken = claimed.refreshToken;

    if (!refreshToken) {
      return { kind: 'not-refreshable' };
    }

    let result: RefreshResult;

    try {
      result = await this.runtime.refresh(
        await this.defined.ofTeam(claimed.teamId),
        { teamId: claimed.teamId, workspaceId: claimed.workspaceId },
        claimed.integration,
        refreshToken,
      );
    } catch (error) {
      await this.saveWithRetry(claimed, refreshToken, (current) =>
        current.refreshReleased(),
      );
      throw error;
    }

    const at = this.clock.now();

    if (result.kind === 'refreshed') {
      await this.saveWithRetry(claimed, refreshToken, (current) =>
        current.refreshedWith(result.tokens),
      );
    }

    if (result.kind === 'failed') {
      await this.saveWithRetry(claimed, refreshToken, (current) =>
        current.refreshFailed(at),
      );
    }

    if (result.kind === 'not-refreshable') {
      await this.saveWithRetry(claimed, refreshToken, (current) =>
        current.refreshReleased(),
      );
    }

    return result;
  }

  private async saveWithRetry(
    claimed: IntegrationConnection,
    used: AccessToken,
    change: (current: IntegrationConnection) => IntegrationConnection,
  ): Promise<void> {
    let current: IntegrationConnection | null = claimed;

    for (let attempt = 1; current; attempt++) {
      try {
        await this.connections.save(change(current));
        return;
      } catch (error) {
        if (
          !(error instanceof IntegrationConnectionVersionConflictError) ||
          attempt >= MAX_SAVE_ATTEMPTS
        ) {
          throw error;
        }
      }

      const reloaded = await this.connections.of(
        claimed.teamId,
        claimed.integration,
        claimed.owner,
      );

      current = reloaded?.refreshToken?.equals(used) ? reloaded : null;
    }
  }
}
