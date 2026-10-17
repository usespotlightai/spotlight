import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { IntegrationConnectionVersionConflictError } from '@integrations/domain/exceptions/integration-connection-version-conflict.error';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { RefreshClaim } from '@integrations/domain/value-objects/refresh-claim.vo';
import { integrationConnection } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Credential } from '@secrets/application/contracts/credential.contract';
import type { CredentialEncryptionPort } from '@secrets/application/ports/credential-encryption.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';

type Row = typeof integrationConnection.$inferSelect;

type TokenKind = 'access' | 'refresh';

const labelFor = (
  teamId: string,
  integration: string,
  owner: string,
  kind: TokenKind,
): string =>
  ['integration-connection', teamId, integration, owner, kind].join(':');

const keyOf = (connection: IntegrationConnection) =>
  and(
    eq(integrationConnection.teamId, connection.teamId.value),
    eq(integrationConnection.integration, connection.integration.value),
    eq(integrationConnection.owner, connection.owner.key),
  );

@Injectable()
export class DrizzleIntegrationConnections
  implements IntegrationConnectionRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
    private readonly encryption: CredentialEncryptionPort,
  ) {}

  async of(
    teamId: TeamId,
    integration: IntegrationKey,
    owner: ConnectionOwner,
  ): Promise<IntegrationConnection | null> {
    const [found] = await this.context.db
      .select()
      .from(integrationConnection)
      .where(
        and(
          eq(integrationConnection.teamId, teamId.value),
          eq(integrationConnection.integration, integration.value),
          eq(integrationConnection.owner, owner.key),
        ),
      )
      .limit(1);

    return found ? await this.rehydrate(found) : null;
  }

  async save(connection: IntegrationConnection): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(connection);
      await this.events.dispatch(connection.pullEvents());
    });
  }

  async remove(connection: IntegrationConnection): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(integrationConnection)
        .where(keyOf(connection));
      await this.events.dispatch(connection.pullEvents());
    });
  }

  async expiringBefore(
    horizon: Date,
  ): Promise<readonly IntegrationConnection[]> {
    const rows = await this.context.db
      .select()
      .from(integrationConnection)
      .where(
        and(
          isNotNull(integrationConnection.refreshToken),
          isNull(integrationConnection.refreshFailedAt),
          lt(integrationConnection.expiresAt, horizon),
        ),
      );

    return Promise.all(rows.map((row) => this.rehydrate(row)));
  }

  async deleteForTeam(teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(integrationConnection)
      .where(eq(integrationConnection.teamId, teamId.value));
  }

  private async stored(connection: IntegrationConnection): Promise<void> {
    const written = {
      accessToken: await this.encrypted(
        connection,
        'access',
        connection.accessToken.value,
      ),
      refreshToken: connection.refreshToken
        ? await this.encrypted(
            connection,
            'refresh',
            connection.refreshToken.value,
          )
        : null,
      expiresAt: connection.expiresAt,
      scopes: connection.scopes.join(' '),
      linkedAccount: connection.linkedAccount,
      refreshFailedAt: connection.refreshFailedAt,
      refreshClaimedUntil: connection.refreshClaim?.until ?? null,
    };

    if (connection.isNew) {
      await this.context.db
        .insert(integrationConnection)
        .values({
          workspaceId: connection.workspaceId.value,
          teamId: connection.teamId.value,
          integration: connection.integration.value,
          owner: connection.owner.key,
          ...written,
        })
        .onConflictDoUpdate({
          target: [
            integrationConnection.teamId,
            integrationConnection.integration,
            integrationConnection.owner,
          ],
          set: {
            ...written,
            version: sql`${integrationConnection.version} + 1`,
            connectedAt: sql`now()`,
          },
        });

      return;
    }

    const updated = await this.context.db
      .update(integrationConnection)
      .set({ ...written, version: connection.version + 1 })
      .where(
        and(
          keyOf(connection),
          eq(integrationConnection.version, connection.version),
        ),
      )
      .returning({ integration: integrationConnection.integration });

    if (updated.length === 0) {
      throw new IntegrationConnectionVersionConflictError(
        connection.integration.value,
      );
    }
  }

  private encrypted(
    connection: IntegrationConnection,
    kind: TokenKind,
    plain: string,
  ): Promise<string> {
    return this.encryption.encrypt(
      connection.workspaceId.value,
      labelFor(
        connection.teamId.value,
        connection.integration.value,
        connection.owner.key,
        kind,
      ),
      Credential.of(plain),
    );
  }

  private async decrypted(
    row: Row,
    kind: TokenKind,
    ciphertext: string,
  ): Promise<string> {
    return (
      await this.encryption.decrypt(
        row.workspaceId,
        labelFor(row.teamId, row.integration, row.owner, kind),
        ciphertext,
      )
    ).revealed();
  }

  private async rehydrate(row: Row): Promise<IntegrationConnection> {
    return IntegrationConnection.rehydrate({
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      integration: IntegrationKey.of(row.integration),
      owner: ConnectionOwner.fromKey(row.owner),
      accessToken: AccessToken.of(
        await this.decrypted(row, 'access', row.accessToken),
      ),
      refreshToken: row.refreshToken
        ? AccessToken.of(await this.decrypted(row, 'refresh', row.refreshToken))
        : null,
      expiresAt: row.expiresAt,
      scopes: row.scopes ? row.scopes.split(' ') : [],
      linkedAccount: row.linkedAccount,
      refreshFailedAt: row.refreshFailedAt,
      refreshClaim: row.refreshClaimedUntil
        ? RefreshClaim.until(row.refreshClaimedUntil)
        : null,
      version: row.version,
    });
  }
}
