import { HostConnection } from '@domain/aggregates/host-connection.aggregate';
import type {
  HostConnectionRepository,
  HostConnectionSummary,
} from '@domain/repositories/host-connection.repository';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { oauth2Connection } from '@infrastructure/persistence/drizzle/schemas/integration.schema';
import type { SecretCipher } from '@infrastructure/secrets/secret.cipher';
import { Injectable } from '@nestjs/common';
import { and, asc, eq, isNotNull, lt } from 'drizzle-orm';

type Row = typeof oauth2Connection.$inferSelect;

@Injectable()
export class DrizzleHostConnections implements HostConnectionRepository {
  constructor(
    private readonly context: DrizzleContext,
    private readonly cipher: SecretCipher,
  ) {}

  async of(teamId: TeamId, source: SourceKey): Promise<HostConnection | null> {
    const [found] = await this.context.db
      .select()
      .from(oauth2Connection)
      .where(
        and(
          eq(oauth2Connection.teamId, teamId.value),
          eq(oauth2Connection.source, source.value),
        ),
      )
      .limit(1);

    return found ? this.rehydrate(found) : null;
  }

  async save(connection: HostConnection): Promise<void> {
    const accessToken = this.cipher.seal(connection.accessToken);
    const refreshToken = connection.refreshToken
      ? this.cipher.seal(connection.refreshToken)
      : null;
    const scopes = connection.scopes.join(' ');

    await this.context.db
      .insert(oauth2Connection)
      .values({
        teamId: connection.teamId.value,
        source: connection.source.value,
        accessToken,
        refreshToken,
        expiresAt: connection.expiresAt,
        scopes,
        identity: connection.handle,
      })
      .onConflictDoUpdate({
        target: [oauth2Connection.teamId, oauth2Connection.source],
        // connectedAt deliberately untouched: a renewal is not a new connection.
        set: {
          accessToken,
          refreshToken,
          expiresAt: connection.expiresAt,
          scopes,
          identity: connection.handle,
        },
      });
  }

  async held(teamId: TeamId): Promise<readonly HostConnectionSummary[]> {
    const rows = await this.context.db
      .select({
        source: oauth2Connection.source,
        identity: oauth2Connection.identity,
        connectedAt: oauth2Connection.connectedAt,
      })
      .from(oauth2Connection)
      .where(eq(oauth2Connection.teamId, teamId.value))
      .orderBy(asc(oauth2Connection.source));

    return rows.map((row) => ({
      source: row.source,
      handle: row.identity,
      connectedAt: row.connectedAt,
    }));
  }

  async nearingExpiry(before: Date): Promise<readonly HostConnection[]> {
    const rows = await this.context.db
      .select()
      .from(oauth2Connection)
      .where(
        and(
          isNotNull(oauth2Connection.refreshToken),
          isNotNull(oauth2Connection.expiresAt),
          lt(oauth2Connection.expiresAt, before),
        ),
      );

    return rows.map((row) => this.rehydrate(row));
  }

  private rehydrate(row: Row): HostConnection {
    return HostConnection.rehydrate({
      teamId: TeamId.of(row.teamId),
      source: SourceKey.of(row.source),
      accessToken: this.cipher.open(row.accessToken),
      refreshToken: row.refreshToken
        ? this.cipher.open(row.refreshToken)
        : null,
      expiresAt: row.expiresAt,
      scopes: row.scopes ? row.scopes.split(' ') : [],
      handle: row.identity,
    });
  }
}
