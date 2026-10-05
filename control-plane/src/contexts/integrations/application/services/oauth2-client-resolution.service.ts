import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { ConfiguredOAuth2ClientsPort } from '@integrations/application/ports/configured-oauth2-clients.port';
import type { OAuth2ClientRegistrarPort } from '@integrations/application/ports/oauth2-client-registrar.port';
import type {
  OAuth2Client,
  OAuth2ClientsPort,
} from '@integrations/application/ports/oauth2-clients.port';
import { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import { OAuth2ClientRegistrationMovedOnError } from '@integrations/domain/exceptions/oauth2-client-registration-moved-on.error';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const clientOf = (registration: OAuth2ClientRegistration): OAuth2Client => ({
  id: registration.clientId,
  secret: registration.clientSecret?.value ?? null,
});

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
  ): Promise<OAuth2Client | null> {
    const configured = this.configured.of(source.value);

    if (configured) {
      return configured;
    }

    const held = await this.registrations.of(teamId, source);

    return held?.liveAt(this.clock.now()) ? clientOf(held) : null;
  }

  async clientFor(
    teamId: TeamId,
    source: SourceKey,
    registration: string | null,
  ): Promise<OAuth2Client | null> {
    const configured = this.configured.of(source.value);

    if (configured || !registration) {
      return configured;
    }

    const wanted = {
      registrationEndpoint: registration,
      redirectUri: this.callback,
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

    const registered = OAuth2ClientRegistration.registered({
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
        held ? held.replacedBy(registered) : registered,
      );
    } catch (error) {
      if (!(error instanceof OAuth2ClientRegistrationMovedOnError)) {
        throw error;
      }

      const winner = await this.registrations.of(teamId, source);

      return winner ? clientOf(winner) : null;
    }

    return clientOf(registered);
  }
}
