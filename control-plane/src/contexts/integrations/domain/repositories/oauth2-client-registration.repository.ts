import type { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const OAUTH2_CLIENT_REGISTRATIONS = Symbol(
  'OAUTH2_CLIENT_REGISTRATIONS',
);

export interface OAuth2ClientRegistrationRepository {
  of(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<OAuth2ClientRegistration | null>;

  save(registration: OAuth2ClientRegistration): Promise<void>;

  deleteForTeam(teamId: TeamId): Promise<void>;
}
