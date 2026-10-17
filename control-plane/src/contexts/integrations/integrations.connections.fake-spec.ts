import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { HostConnectionVersionConflictError } from '@integrations/domain/exceptions/host-connection-version-conflict.error';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import type { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const keyOf = (teamId: TeamId, source: SourceKey, holder: ConnectionHolder) =>
  `${teamId.value}:${source.value}:${holder.key}`;

const keptAs = (connection: HostConnection, version: number) =>
  HostConnection.rehydrate({
    workspaceId: connection.workspaceId,
    teamId: connection.teamId,
    source: connection.source,
    holder: connection.holder,
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
    scopes: connection.scopes,
    handle: connection.handle,
    renewalRefusedAt: connection.renewalRefusedAt,
    renewalClaim: connection.renewalClaim,
    version,
  });

export class InMemoryHostConnections implements HostConnectionRepository {
  readonly #held = new Map<string, HostConnection>();
  readonly saved: HostConnection[] = [];
  readonly events: DomainEvent[] = [];
  #conflicts = 0;

  hold(connection: HostConnection): void {
    this.#held.set(
      keyOf(connection.teamId, connection.source, connection.holder),
      keptAs(connection, Math.max(connection.version, 1)),
    );
  }

  conflictOnNext(times = 1): void {
    this.#conflicts = times;
  }

  bump(teamId: TeamId, source: SourceKey, holder: ConnectionHolder): void {
    const key = keyOf(teamId, source, holder);
    const held = this.#held.get(key);

    if (held) {
      this.#held.set(key, keptAs(held, held.version + 1));
    }
  }

  async of(
    teamId: TeamId,
    source: SourceKey,
    holder: ConnectionHolder,
  ): Promise<HostConnection | null> {
    return this.#held.get(keyOf(teamId, source, holder)) ?? null;
  }

  async save(connection: HostConnection): Promise<void> {
    const key = keyOf(connection.teamId, connection.source, connection.holder);
    const held = this.#held.get(key);

    if (this.#conflicts > 0) {
      this.#conflicts--;
      if (held) {
        this.#held.set(key, keptAs(held, held.version + 1));
      }
      throw new HostConnectionVersionConflictError(connection.source.value);
    }

    if (!connection.isNew && held?.version !== connection.version) {
      throw new HostConnectionVersionConflictError(connection.source.value);
    }

    this.#held.set(key, keptAs(connection, (held?.version ?? 0) + 1));
    this.saved.push(connection);
    this.events.push(...connection.pullEvents());
  }

  async remove(connection: HostConnection): Promise<void> {
    this.#held.delete(
      keyOf(connection.teamId, connection.source, connection.holder),
    );
    this.events.push(...connection.pullEvents());
  }

  async expiringBefore(horizon: Date): Promise<readonly HostConnection[]> {
    return [...this.#held.values()].filter(
      (each) =>
        each.refreshToken !== null &&
        each.renewalRefusedAt === null &&
        each.expiresAt !== null &&
        each.expiresAt.getTime() < horizon.getTime(),
    );
  }

  async forgetTeam(teamId: TeamId): Promise<void> {
    for (const [key, each] of this.#held) {
      if (each.teamId.equals(teamId)) {
        this.#held.delete(key);
      }
    }
  }
}
