import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { HostConnectionVersionConflictError } from '@integrations/domain/exceptions/host-connection-version-conflict.error';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { RenewalClaim } from '@integrations/domain/value-objects/renewal-claim.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { hostConnection } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Credential } from '@secrets/application/contracts/credential.contract';
import type { CredentialSealingPort } from '@secrets/application/ports/credential-sealing.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';

type Row = typeof hostConnection.$inferSelect;

type Held = 'access' | 'refresh';

const labelFor = (
  teamId: string,
  source: string,
  holder: string,
  held: Held,
): string => ['host-connection', teamId, source, holder, held].join(':');

const keyOf = (connection: HostConnection) =>
  and(
    eq(hostConnection.teamId, connection.teamId.value),
    eq(hostConnection.source, connection.source.value),
    eq(hostConnection.holder, connection.holder.key),
  );

@Injectable()
export class DrizzleHostConnections implements HostConnectionRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
    private readonly sealing: CredentialSealingPort,
  ) {}

  async of(
    teamId: TeamId,
    source: SourceKey,
    holder: ConnectionHolder,
  ): Promise<HostConnection | null> {
    const [found] = await this.context.db
      .select()
      .from(hostConnection)
      .where(
        and(
          eq(hostConnection.teamId, teamId.value),
          eq(hostConnection.source, source.value),
          eq(hostConnection.holder, holder.key),
        ),
      )
      .limit(1);

    return found ? await this.rehydrate(found) : null;
  }

  async save(connection: HostConnection): Promise<void> {
    await this.context.run(async () => {
      await this.stored(connection);
      await this.events.dispatch(connection.pullEvents());
    });
  }

  async remove(connection: HostConnection): Promise<void> {
    await this.context.run(async () => {
      await this.context.db.delete(hostConnection).where(keyOf(connection));
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

    return Promise.all(rows.map((row) => this.rehydrate(row)));
  }

  async forgetTeam(teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(hostConnection)
      .where(eq(hostConnection.teamId, teamId.value));
  }

  private async stored(connection: HostConnection): Promise<void> {
    const written = {
      accessToken: await this.sealed(
        connection,
        'access',
        connection.accessToken.value,
      ),
      refreshToken: connection.refreshToken
        ? await this.sealed(
            connection,
            'refresh',
            connection.refreshToken.value,
          )
        : null,
      expiresAt: connection.expiresAt,
      scopes: connection.scopes.join(' '),
      handle: connection.handle,
      renewalRefusedAt: connection.renewalRefusedAt,
      renewalClaimedUntil: connection.renewalClaim?.until ?? null,
    };

    if (connection.isNew) {
      await this.context.db
        .insert(hostConnection)
        .values({
          workspaceId: connection.workspaceId.value,
          teamId: connection.teamId.value,
          source: connection.source.value,
          holder: connection.holder.key,
          ...written,
        })
        .onConflictDoUpdate({
          target: [
            hostConnection.teamId,
            hostConnection.source,
            hostConnection.holder,
          ],
          set: {
            ...written,
            version: sql`${hostConnection.version} + 1`,
            connectedAt: sql`now()`,
          },
        });

      return;
    }

    const updated = await this.context.db
      .update(hostConnection)
      .set({ ...written, version: connection.version + 1 })
      .where(
        and(keyOf(connection), eq(hostConnection.version, connection.version)),
      )
      .returning({ source: hostConnection.source });

    if (updated.length === 0) {
      throw new HostConnectionVersionConflictError(connection.source.value);
    }
  }

  private sealed(
    connection: HostConnection,
    held: Held,
    plain: string,
  ): Promise<string> {
    return this.sealing.seal(
      connection.workspaceId.value,
      labelFor(
        connection.teamId.value,
        connection.source.value,
        connection.holder.key,
        held,
      ),
      Credential.of(plain),
    );
  }

  private async opened(row: Row, held: Held, sealed: string): Promise<string> {
    return (
      await this.sealing.open(
        row.workspaceId,
        labelFor(row.teamId, row.source, row.holder, held),
        sealed,
      )
    ).revealed();
  }

  private async rehydrate(row: Row): Promise<HostConnection> {
    return HostConnection.rehydrate({
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      source: SourceKey.of(row.source),
      holder: ConnectionHolder.fromKey(row.holder),
      accessToken: AccessToken.of(
        await this.opened(row, 'access', row.accessToken),
      ),
      refreshToken: row.refreshToken
        ? AccessToken.of(await this.opened(row, 'refresh', row.refreshToken))
        : null,
      expiresAt: row.expiresAt,
      scopes: row.scopes ? row.scopes.split(' ') : [],
      handle: row.handle,
      renewalRefusedAt: row.renewalRefusedAt,
      renewalClaim: row.renewalClaimedUntil
        ? RenewalClaim.until(row.renewalClaimedUntil)
        : null,
      version: row.version,
    });
  }
}
