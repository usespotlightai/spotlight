import type { OAuth2Client } from '@integrations/application/ports/oauth2-clients.port';
import type { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import type { ConnectionOwnerKind } from '@integrations/domain/value-objects/connection-owner.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const OAUTH2_LINKING = Symbol('OAUTH2_LINKING');

export interface OAuth2Start {
  readonly url: string;
  readonly nonce: string;
  readonly expiresAt: Date;
}

export interface OAuth2Returned {
  readonly state: string;
  readonly code: string;
  readonly nonce: string | null;
  readonly viewerId: UserId | null;
}

export interface OAuth2LinkInput {
  readonly teamId: TeamId;
  readonly integration: IntegrationKey;
  readonly by: UserId;
  readonly owner: ConnectionOwnerKind;
  readonly returnTo: string | null;
}

export interface OAuth2Authorized extends OAuth2LinkInput {
  readonly tokens: OAuthTokens;
}

export type OAuth2Refusal =
  | 'state-not-accepted'
  | 'nonce-mismatch'
  | 'other-person'
  | 'nonce-spent'
  | 'no-team'
  | 'no-oauth2-endpoints'
  | 'no-client'
  | 'token-exchange-failed';

export interface OAuth2Refused {
  readonly refused: OAuth2Refusal;
  readonly teamId?: TeamId;
  readonly integration?: IntegrationKey;
}

export interface OAuth2Registration {
  readonly endpoint: string | null;
  readonly server: AuthorizationServer | null;
}

export interface OAuth2LinkingPort {
  registrationFor(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<OAuth2Registration | null>;

  begin(
    input: OAuth2LinkInput,
    client: OAuth2Client,
  ): Promise<OAuth2Start | null>;

  authorized(
    returned: OAuth2Returned,
  ): Promise<OAuth2Authorized | OAuth2Refused>;

  landingFor(
    teamId: TeamId,
    integration: IntegrationKey,
    returnTo: string | null,
  ): Promise<string>;
}
