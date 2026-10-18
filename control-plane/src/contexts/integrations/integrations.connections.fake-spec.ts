import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { IntegrationConnectionVersionConflictError } from '@integrations/domain/exceptions/integration-connection-version-conflict.error';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const keyOf = (
  teamId: TeamId,
  integration: IntegrationKey,
  owner: ConnectionOwner,
) => `${teamId.value}:${integration.value}:${owner.key}`;

const storedAs = (connection: IntegrationConnection, version: number) =>
  IntegrationConnection.rehydrate({
    workspaceId: connection.workspaceId,
    teamId: connection.teamId,
    integration: connection.integration,
    owner: connection.owner,
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
    scopes: connection.scopes,
    linkedAccount: connection.linkedAccount,
    refreshFailedAt: connection.refreshFailedAt,
    refreshClaim: connection.refreshClaim,
    version,
  });

export class InMemoryIntegrationConnections
  implements IntegrationConnectionRepository
{
  readonly #stored = new Map<string, IntegrationConnection>();
  readonly saved: IntegrationConnection[] = [];
  readonly events: DomainEvent[] = [];
  #conflicts = 0;

  add(connection: IntegrationConnection): void {
    this.#stored.set(
      keyOf(connection.teamId, connection.integration, connection.owner),
      storedAs(connection, Math.max(connection.version, 1)),
    );
  }

  conflictOnNext(times = 1): void {
    this.#conflicts = times;
  }

  bump(
    teamId: TeamId,
    integration: IntegrationKey,
    owner: ConnectionOwner,
  ): void {
    const key = keyOf(teamId, integration, owner);
    const stored = this.#stored.get(key);

    if (stored) {
      this.#stored.set(key, storedAs(stored, stored.version + 1));
    }
  }

  async of(
    teamId: TeamId,
    integration: IntegrationKey,
    owner: ConnectionOwner,
  ): Promise<IntegrationConnection | null> {
    return this.#stored.get(keyOf(teamId, integration, owner)) ?? null;
  }

  async save(connection: IntegrationConnection): Promise<void> {
    const key = keyOf(
      connection.teamId,
      connection.integration,
      connection.owner,
    );
    const stored = this.#stored.get(key);

    if (this.#conflicts > 0) {
      this.#conflicts--;
      if (stored) {
        this.#stored.set(key, storedAs(stored, stored.version + 1));
      }
      throw new IntegrationConnectionVersionConflictError(
        connection.integration.value,
      );
    }

    if (!connection.isNew && stored?.version !== connection.version) {
      throw new IntegrationConnectionVersionConflictError(
        connection.integration.value,
      );
    }

    this.#stored.set(key, storedAs(connection, (stored?.version ?? 0) + 1));
    this.saved.push(connection);
    this.events.push(...connection.pullEvents());
  }

  async remove(connection: IntegrationConnection): Promise<void> {
    this.#stored.delete(
      keyOf(connection.teamId, connection.integration, connection.owner),
    );
    this.events.push(...connection.pullEvents());
  }

  async expiringBefore(
    horizon: Date,
  ): Promise<readonly IntegrationConnection[]> {
    return [...this.#stored.values()].filter(
      (each) =>
        each.refreshToken !== null &&
        each.refreshFailedAt === null &&
        each.expiresAt !== null &&
        each.expiresAt.getTime() < horizon.getTime(),
    );
  }

  async deleteForTeam(teamId: TeamId): Promise<void> {
    for (const [key, each] of this.#stored) {
      if (each.teamId.equals(teamId)) {
        this.#stored.delete(key);
      }
    }
  }
}
