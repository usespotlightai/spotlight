import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  ConfiguredOAuth2Client,
  ConfiguredOAuth2ClientsPort,
} from '@integrations/application/ports/configured-oauth2-clients.port';
import type { OAuth2ClientRegistrarPort } from '@integrations/application/ports/oauth2-client-registrar.port';
import type {
  OAuth2Client,
  OAuth2ClientsPort,
} from '@integrations/application/ports/oauth2-clients.port';
import { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import { OAuth2ClientRegistrationVersionConflictError } from '@integrations/domain/exceptions/oauth2-client-registration-version-conflict.error';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const clientOf = (registration: OAuth2ClientRegistration): OAuth2Client => ({
  id: registration.clientId,
  secret: registration.clientSecret?.value ?? null,
});

const configuredFor = (
  configured: ConfiguredOAuth2Client,
  server: AuthorizationServer | null,
): OAuth2Client | null =>
  server === null || configured.issuer === server.issuer
    ? { id: configured.id, secret: configured.secret }
    : null;

export class OAuth2ClientResolution implements OAuth2ClientsPort {
  constructor(
    private readonly configured: ConfiguredOAuth2ClientsPort,
    private readonly registrations: OAuth2ClientRegistrationRepository,
    private readonly registrar: OAuth2ClientRegistrarPort,
    private readonly teams: TeamDirectoryPort,
    private readonly clock: ClockPort,
    private readonly callback: string,
  ) {}

  async heldFor(
    teamId: TeamId,
    source: SourceKey,
    server: AuthorizationServer | null,
  ): Promise<OAuth2Client | null> {
    const configured = this.configured.of(source.value);

    if (configured) {
      return configuredFor(configured, server);
    }

    const held = await this.registrations.of(teamId, source);

    return held?.liveAt(this.clock.now()) && held.servedBy(server)
      ? clientOf(held)
      : null;
  }

  async clientFor(
    teamId: TeamId,
    source: SourceKey,
    registration: string | null,
    server: AuthorizationServer | null,
  ): Promise<OAuth2Client | null> {
    const configured = this.configured.of(source.value);

    if (configured) {
      return configuredFor(configured, server);
    }

    if (!registration) {
      return null;
    }

    const wanted = {
      registrationEndpoint: registration,
      redirectUri: this.callback,
      server,
    };
    const held = await this.registrations.of(teamId, source);

    if (held?.fits(wanted, this.clock.now())) {
      return clientOf(held);
    }

    const team = await this.teams.find(teamId);
    const answered = team
      ? await this.registrar.register(registration, this.callback)
      : null;

    if (!team || !answered) {
      return null;
    }

    const registered = OAuth2ClientRegistration.register({
      workspaceId: team.workspaceId,
      teamId,
      source,
      ...wanted,
      clientId: answered.clientId,
      clientSecret: AccessToken.maybe(answered.clientSecret),
      secretExpiresAt: answered.secretExpiresAt,
    });

    try {
      await this.registrations.save(
        held ? held.replaceWith(registered) : registered,
      );
    } catch (error) {
      if (!(error instanceof OAuth2ClientRegistrationVersionConflictError)) {
        throw error;
      }

      const winner = await this.registrations.of(teamId, source);

      return winner?.servedBy(server) ? clientOf(winner) : null;
    }

    return clientOf(registered);
  }
}
