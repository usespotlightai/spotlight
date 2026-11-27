import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import {
  OAuth2ClientMissingError,
  type OtherIssuer,
} from '@integrations/application/errors/oauth2-client-missing.error';
import { OAuth2ServerUnavailableError } from '@integrations/application/errors/oauth2-server-unavailable.error';
import type {
  ConfiguredOAuth2Client,
  ConfiguredOAuth2ClientsPort,
} from '@integrations/application/ports/configured-oauth2-clients.port';
import type { OAuth2ClientRegistrarPort } from '@integrations/application/ports/oauth2-client-registrar.port';
import type { OAuth2ClientSecretsPort } from '@integrations/application/ports/oauth2-client-secrets.port';
import type {
  OAuth2Client,
  OAuth2ClientSource,
  OAuth2ClientsPort,
  OwnOAuth2Client,
} from '@integrations/application/ports/oauth2-clients.port';
import type { OAuth2Registration } from '@integrations/application/ports/oauth2-linking.port';
import { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import { OAuth2ClientRegistrationVersionConflictError } from '@integrations/domain/exceptions/oauth2-client-registration-version-conflict.error';
import { TeamNotFoundError } from '@integrations/domain/exceptions/team-not-found.error';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import { ClientSecret } from '@integrations/domain/value-objects/client-secret.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuth2Endpoint } from '@integrations/domain/value-objects/oauth2-endpoint.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const clientOf = (registration: OAuth2ClientRegistration): OAuth2Client => ({
  id: registration.clientId.value,
  secret: registration.clientSecret?.value ?? null,
});

const otherIssuerOf = (
  configured: ConfiguredOAuth2Client,
  server: AuthorizationServer | null,
): OtherIssuer | null =>
  server && !AuthorizationServer.takesClientIssuedFor(server, configured.issuer)
    ? { named: configured.issuer, required: server.issuer }
    : null;

const configuredFor = (
  configured: ConfiguredOAuth2Client,
  server: AuthorizationServer | null,
): OAuth2Client | null =>
  otherIssuerOf(configured, server)
    ? null
    : { id: configured.id, secret: configured.secret };

export class OAuth2ClientResolution implements OAuth2ClientsPort {
  constructor(
    private readonly configured: ConfiguredOAuth2ClientsPort,
    private readonly registrations: OAuth2ClientRegistrationRepository,
    private readonly registrar: OAuth2ClientRegistrarPort,
    private readonly teams: TeamDirectoryPort,
    private readonly clock: ClockPort,
    private readonly callback: string,
    private readonly logger: LoggerPort,
    private readonly secrets: OAuth2ClientSecretsPort,
  ) {}

  async existingFor(
    teamId: TeamId,
    integration: IntegrationKey,
    { own, server }: OAuth2ClientSource,
  ): Promise<OAuth2Client | null> {
    if (own) {
      return this.ownClient(teamId, own);
    }

    const configured = this.configured.of(integration.value);

    if (configured) {
      return configuredFor(configured, server);
    }

    const existing = await this.registrations.of(teamId, integration);

    return existing?.liveAt(this.clock.now()) === true &&
      existing.servedBy(server)
      ? clientOf(existing)
      : null;
  }

  async clientFor(
    teamId: TeamId,
    integration: IntegrationKey,
    { own, server, endpoint: registration }: OAuth2Registration,
  ): Promise<OAuth2Client> {
    if (own) {
      return this.ownClient(teamId, own);
    }

    const configured = this.configured.of(integration.value);

    if (configured) {
      const otherIssuer = otherIssuerOf(configured, server);

      if (otherIssuer) {
        throw this.missing(integration, otherIssuer);
      }

      return { id: configured.id, secret: configured.secret };
    }

    if (registration === null || registration === '') {
      throw this.missing(integration, null);
    }

    const wanted = {
      registrationEndpoint: OAuth2Endpoint.of(registration),
      redirectUri: OAuth2Endpoint.of(this.callback),
      server,
    };
    const existing = await this.registrations.of(teamId, integration);

    if (existing?.fits(wanted, this.clock.now()) === true) {
      return clientOf(existing);
    }

    const team = await this.teamOf(teamId);
    const answered = await this.registrar.register(
      wanted.registrationEndpoint,
      wanted.redirectUri,
    );

    if (!answered) {
      throw new OAuth2ServerUnavailableError(
        integration.value,
        'registration-failed',
      );
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

      if (winner?.servedBy(server) !== true) {
        throw new OAuth2ServerUnavailableError(
          integration.value,
          'registration-failed',
        );
      }

      return clientOf(winner);
    }

    return clientOf(registered);
  }

  private async ownClient(
    teamId: TeamId,
    own: OwnOAuth2Client,
  ): Promise<OAuth2Client> {
    if (!own.secret) {
      return { id: own.id, secret: null };
    }

    const team = await this.teamOf(teamId);

    return {
      id: own.id,
      secret: await this.secrets.sentTo(
        team.workspaceId,
        own.secret,
        own.token,
      ),
    };
  }

  private async teamOf(teamId: TeamId) {
    const team = await this.teams.find(teamId);

    if (!team) {
      throw new TeamNotFoundError(teamId.value);
    }

    return team;
  }

  private missing(
    integration: IntegrationKey,
    otherIssuer: OtherIssuer | null,
  ): OAuth2ClientMissingError {
    this.logger.warn(
      {
        integration: integration.value,
        named: otherIssuer?.named,
        required: otherIssuer?.required,
      },
      otherIssuer
        ? 'OAUTH_CLIENTS entry names an issuer other than the authorization server'
        : 'No OAUTH_CLIENTS entry for the integration',
    );

    return new OAuth2ClientMissingError(integration.value, otherIssuer);
  }
}
