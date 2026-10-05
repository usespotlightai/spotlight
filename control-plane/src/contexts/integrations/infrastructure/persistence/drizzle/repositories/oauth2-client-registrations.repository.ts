import { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import { OAuth2ClientRegistrationMovedOnError } from '@integrations/domain/exceptions/oauth2-client-registration-moved-on.error';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { oauth2ClientRegistration } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Credential } from '@secrets/application/contracts/credential.contract';
import type { CredentialSealingPort } from '@secrets/application/ports/credential-sealing.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type Row = typeof oauth2ClientRegistration.$inferSelect;

const labelFor = (teamId: string, source: string): string =>
  ['oauth2-client', teamId, source, 'secret'].join(':');

export class DrizzleOAuth2ClientRegistrations
  implements OAuth2ClientRegistrationRepository
{
  constructor(
    private readonly context: DrizzleContext,
    private readonly sealing: CredentialSealingPort,
  ) {}

  async of(
    teamId: TeamId,
    source: SourceKey,
  ): Promise<OAuth2ClientRegistration | null> {
    const [found] = await this.context.db
      .select()
      .from(oauth2ClientRegistration)
      .where(
        and(
          eq(oauth2ClientRegistration.teamId, teamId.value),
          eq(oauth2ClientRegistration.source, source.value),
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
        ? await this.sealing.seal(
            registration.workspaceId.value,
            labelFor(registration.teamId.value, registration.source.value),
            Credential.of(registration.clientSecret.value),
          )
        : null,
      secretExpiresAt: registration.secretExpiresAt,
    };

    const kept = registration.isNew
      ? await this.context.db
          .insert(oauth2ClientRegistration)
          .values({
            workspaceId: registration.workspaceId.value,
            teamId: registration.teamId.value,
            source: registration.source.value,
            ...written,
          })
          .onConflictDoNothing()
          .returning({ source: oauth2ClientRegistration.source })
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
              eq(oauth2ClientRegistration.source, registration.source.value),
              eq(oauth2ClientRegistration.version, registration.version),
            ),
          )
          .returning({ source: oauth2ClientRegistration.source });

    if (kept.length === 0) {
      throw new OAuth2ClientRegistrationMovedOnError(registration.source.value);
    }
  }

  async forgetTeam(teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(oauth2ClientRegistration)
      .where(eq(oauth2ClientRegistration.teamId, teamId.value));
  }

  private async rehydrate(row: Row): Promise<OAuth2ClientRegistration> {
    return OAuth2ClientRegistration.rehydrate({
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      source: SourceKey.of(row.source),
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
              await this.sealing.open(
                row.workspaceId,
                labelFor(row.teamId, row.source),
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
