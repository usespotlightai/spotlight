import type { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const OAUTH2_CLIENTS = Symbol('OAUTH2_CLIENTS');

export interface OAuth2Client {
  readonly id: string;
  readonly secret: string | null;
}

export interface OwnOAuth2Client {
  readonly id: string;
  readonly secret: SecretName | null;
  readonly token: string;
}

export interface OAuth2ClientSource {
  readonly own: OwnOAuth2Client | null;
  readonly server: AuthorizationServer | null;
}

export interface OAuth2ClientsPort {
  existingFor(
    teamId: TeamId,
    integration: IntegrationKey,
    source: OAuth2ClientSource,
  ): Promise<OAuth2Client | null>;
}
