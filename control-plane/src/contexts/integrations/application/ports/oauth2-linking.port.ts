import type { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';

export const OAUTH2_LINKING = Symbol('OAUTH2_LINKING');

export const OAUTH2_CALLBACK_ROUTE = 'integrations/oauth/callback';

export interface OAuth2Begun {
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

export interface OAuth2Authorized {
  readonly teamId: string;
  readonly source: string;
  readonly by: string;
  readonly grant: HostGrant;
}

export interface OAuth2LinkingPort {
  begin(
    teamId: string,
    source: string,
    by: string,
  ): Promise<OAuth2Begun | null>;

  authorized(returned: OAuth2Returned): Promise<OAuth2Authorized | null>;

  landingFor(teamId: string, source: string): Promise<string>;
}
