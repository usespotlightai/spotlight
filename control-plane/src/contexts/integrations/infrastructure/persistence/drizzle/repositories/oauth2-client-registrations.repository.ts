import { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import { OAuth2ClientRegistrationVersionConflictError } from '@integrations/domain/exceptions/oauth2-client-registration-version-conflict.error';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { oauth2ClientRegistration } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Credential } from '@secrets/application/contracts/credential.contract';
import type { CredentialEncryptionPort } from '@secrets/application/ports/credential-encryption.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type Row = typeof oauth2ClientRegistration.$inferSelect;

const labelFor = (teamId: string, integration: string): string =>
  ['oauth2-client', teamId, integration, 'secret'].join(':');

export class DrizzleOAuth2ClientRegistrations
  implements OAuth2ClientRegistrationRepository
{
  constructor(
    private readonly context: DrizzleContext,
    private readonly encryption: CredentialEncryptionPort,
  ) {}

  async of(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<OAuth2ClientRegistration | null> {
    const [found] = await this.context.db
      .select()
      .from(oauth2ClientRegistration)
      .where(
        and(
          eq(oauth2ClientRegistration.teamId, teamId.value),
          eq(oauth2ClientRegistration.integration, integration.value),
        ),
      )
      .limit(1);

    return found ? await this.rehydrate(found) : null;
  }

  async save(registration: OAuth2ClientRegistration): Promise<void> {
    const written = {
      registrationEndpoint: registration.registrationEndpoint,
      redirectUri: registration.redirectUri,
      issuer: registration.server?.issuer ?? null,
      authorizeEndpoint: registration.server?.authorize ?? null,
      tokenEndpoint: registration.server?.token ?? null,
      clientId: registration.clientId,
      clientSecret: registration.clientSecret
        ? await this.encryption.encrypt(
            registration.workspaceId.value,
            labelFor(registration.teamId.value, registration.integration.value),
            Credential.of(registration.clientSecret.value),
          )
        : null,
      secretExpiresAt: registration.secretExpiresAt,
    };

    const saved = registration.isNew
      ? await this.context.db
          .insert(oauth2ClientRegistration)
          .values({
            workspaceId: registration.workspaceId.value,
            teamId: registration.teamId.value,
            integration: registration.integration.value,
            ...written,
          })
          .onConflictDoNothing()
          .returning({ integration: oauth2ClientRegistration.integration })
      : await this.context.db
          .update(oauth2ClientRegistration)
          .set({
            ...written,
            version: registration.version + 1,
            registeredAt: new Date(),
          })
          .where(
            and(
              eq(oauth2ClientRegistration.teamId, registration.teamId.value),
              eq(
                oauth2ClientRegistration.integration,
                registration.integration.value,
              ),
              eq(oauth2ClientRegistration.version, registration.version),
            ),
          )
          .returning({ integration: oauth2ClientRegistration.integration });

    if (saved.length === 0) {
      throw new OAuth2ClientRegistrationVersionConflictError(
        registration.integration.value,
      );
    }
  }

  async deleteForTeam(teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(oauth2ClientRegistration)
      .where(eq(oauth2ClientRegistration.teamId, teamId.value));
  }

  private async rehydrate(row: Row): Promise<OAuth2ClientRegistration> {
    return OAuth2ClientRegistration.rehydrate({
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      integration: IntegrationKey.of(row.integration),
      registrationEndpoint: row.registrationEndpoint,
      redirectUri: row.redirectUri,
      server:
        row.issuer && row.authorizeEndpoint && row.tokenEndpoint
          ? AuthorizationServer.of({
              issuer: row.issuer,
              authorize: row.authorizeEndpoint,
              token: row.tokenEndpoint,
            })
          : null,
      clientId: row.clientId,
      clientSecret: row.clientSecret
        ? AccessToken.of(
            (
              await this.encryption.decrypt(
                row.workspaceId,
                labelFor(row.teamId, row.integration),
                row.clientSecret,
              )
            ).revealed(),
          )
        : null,
      secretExpiresAt: row.secretExpiresAt,
      version: row.version,
    });
  }
}
