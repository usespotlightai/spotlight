import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { HostConnectionMovedOnError } from '@integrations/domain/exceptions/host-connection-moved-on.error';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { hostConnection } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { SecretCipher } from '@platform/secrets/secret.cipher';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';

type Row = typeof hostConnection.$inferSelect;

@Injectable()
export class DrizzleHostConnections implements HostConnectionRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
    private readonly cipher: SecretCipher,
  ) {}

  async of(teamId: TeamId, source: SourceKey): Promise<HostConnection | null> {
    const [found] = await this.context.db
      .select()
      .from(hostConnection)
      .where(
        and(
          eq(hostConnection.teamId, teamId.value),
          eq(hostConnection.source, source.value),
        ),
      )
      .limit(1);

    return found ? this.rehydrate(found) : null;
  }

  async save(connection: HostConnection): Promise<void> {
    await this.context.run(async () => {
      await this.stored(connection);
      await this.events.dispatch(connection.pullEvents());
    });
  }

  async expiringBefore(horizon: Date): Promise<readonly HostConnection[]> {
    const rows = await this.context.db
      .select()
      .from(hostConnection)
      .where(
        and(
          isNotNull(hostConnection.refreshToken),
          isNull(hostConnection.renewalRefusedAt),
          lt(hostConnection.expiresAt, horizon),
        ),
      );

    return rows.map((row) => this.rehydrate(row));
  }

  private async stored(connection: HostConnection): Promise<void> {
    const written = {
      accessToken: this.cipher.seal(connection.accessToken.value),
      refreshToken: connection.refreshToken
        ? this.cipher.seal(connection.refreshToken.value)
        : null,
      expiresAt: connection.expiresAt,
      scopes: connection.scopes.join(' '),
      handle: connection.handle,
      renewalRefusedAt: connection.renewalRefusedAt,
    };

    if (connection.isNew) {
      await this.context.db
        .insert(hostConnection)
        .values({
          teamId: connection.teamId.value,
          source: connection.source.value,
          ...written,
        })
        .onConflictDoUpdate({
          target: [hostConnection.teamId, hostConnection.source],
          set: { ...written, version: sql`${hostConnection.version} + 1` },
        });

      return;
    }

    const updated = await this.context.db
      .update(hostConnection)
      .set({ ...written, version: connection.version + 1 })
      .where(
        and(
          eq(hostConnection.teamId, connection.teamId.value),
          eq(hostConnection.source, connection.source.value),
          eq(hostConnection.version, connection.version),
        ),
      )
      .returning({ source: hostConnection.source });

    if (updated.length === 0) {
      throw new HostConnectionMovedOnError(connection.source.value);
    }
  }

  private rehydrate(row: Row): HostConnection {
    return HostConnection.rehydrate({
      teamId: TeamId.of(row.teamId),
      source: SourceKey.of(row.source),
      accessToken: AccessToken.of(this.cipher.open(row.accessToken)),
      refreshToken: row.refreshToken
        ? AccessToken.of(this.cipher.open(row.refreshToken))
        : null,
      expiresAt: row.expiresAt,
      scopes: row.scopes ? row.scopes.split(' ') : [],
      handle: row.handle,
      renewalRefusedAt: row.renewalRefusedAt,
      version: row.version,
    });
  }
}
