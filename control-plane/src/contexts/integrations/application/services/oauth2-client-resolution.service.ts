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
import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import { ClientSecret } from '@integrations/domain/value-objects/client-secret.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuth2Endpoint } from '@integrations/domain/value-objects/oauth2-endpoint.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const clientOf = (registration: OAuth2ClientRegistration): OAuth2Client => ({
  id: registration.clientId.value,
  secret: registration.clientSecret?.value ?? null,
});

const configuredFor = (
  configured: ConfiguredOAuth2Client,
  server: AuthorizationServer | null,
): OAuth2Client | null =>
  AuthorizationServer.takesClientIssuedFor(server, configured.issuer)
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

  async existingFor(
    teamId: TeamId,
    integration: IntegrationKey,
    server: AuthorizationServer | null,
  ): Promise<OAuth2Client | null> {
    const configured = this.configured.of(integration.value);

    if (configured) {
      return configuredFor(configured, server);
    }

    const existing = await this.registrations.of(teamId, integration);

    return existing?.liveAt(this.clock.now()) && existing.servedBy(server)
      ? clientOf(existing)
      : null;
  }

  async clientFor(
    teamId: TeamId,
    integration: IntegrationKey,
    registration: string | null,
    server: AuthorizationServer | null,
  ): Promise<OAuth2Client | null> {
    const configured = this.configured.of(integration.value);

    if (configured) {
      return configuredFor(configured, server);
    }

    if (!registration) {
      return null;
    }

    const wanted = {
      registrationEndpoint: OAuth2Endpoint.of(registration),
      redirectUri: OAuth2Endpoint.of(this.callback),
      server,
    };
    const existing = await this.registrations.of(teamId, integration);

    if (existing?.fits(wanted, this.clock.now())) {
      return clientOf(existing);
    }

    const team = await this.teams.find(teamId);
    const answered = team
      ? await this.registrar.register(
          wanted.registrationEndpoint,
          wanted.redirectUri,
        )
      : null;

    if (!team || !answered) {
      return null;
    }

    const registered = OAuth2ClientRegistration.register({
      workspaceId: team.workspaceId,
      teamId,
      integration,
      ...wanted,
      clientId: answered.clientId,
      clientSecret: ClientSecret.maybe(answered.clientSecret),
      secretExpiresAt: answered.secretExpiresAt,
      registeredAt: this.clock.now(),
    });

    try {
      await this.registrations.save(
        existing ? existing.replaceWith(registered) : registered,
      );
    } catch (error) {
      if (!(error instanceof OAuth2ClientRegistrationVersionConflictError)) {
        throw error;
      }

      const winner = await this.registrations.of(teamId, integration);

      return winner?.servedBy(server) ? clientOf(winner) : null;
    }

    return clientOf(registered);
  }
}
