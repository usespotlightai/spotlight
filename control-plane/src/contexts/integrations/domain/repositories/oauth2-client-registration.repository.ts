import type { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const OAUTH2_CLIENT_REGISTRATIONS = Symbol(
  'OAUTH2_CLIENT_REGISTRATIONS',
);

export interface OAuth2ClientRegistrationRepository {
  of(
    teamId: TeamId,
    source: SourceKey,
  ): Promise<OAuth2ClientRegistration | null>;

  save(registration: OAuth2ClientRegistration): Promise<void>;

  forgetTeam(teamId: TeamId): Promise<void>;
}
