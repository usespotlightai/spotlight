import type { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';

export const OAUTH2_LINKING = Symbol('OAUTH2_LINKING');

export const OAUTH2_CALLBACK_ROUTE = 'integrations/oauth/callback';

export type ConnectionOwnerKind = 'team' | 'person';

export interface OAuth2Start {
  readonly url: string;
  readonly nonce: string;
  readonly expiresAt: Date;
}

export interface OAuth2Returned {
  readonly state: string;
  readonly code: string;
  readonly nonce: string | null;
  readonly viewerId: string | null;
}

export interface OAuth2LinkInput {
  readonly teamId: string;
  readonly integration: string;
  readonly by: string;
  readonly owner: ConnectionOwnerKind;
  readonly returnTo: string | null;
}

export interface OAuth2Authorized extends OAuth2LinkInput {
  readonly tokens: OAuthTokens;
}

export interface OAuth2LinkingPort {
  begin(input: OAuth2LinkInput): Promise<OAuth2Start | null>;

  authorized(returned: OAuth2Returned): Promise<OAuth2Authorized | null>;

  landingFor(
    teamId: string,
    integration: string,
    returnTo: string | null,
  ): Promise<string>;
}
