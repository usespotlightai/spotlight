import type { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';

export const OAUTH2_LINKING = Symbol('OAUTH2_LINKING');

export const OAUTH2_CALLBACK_ROUTE = 'integrations/oauth/callback';

export type OAuth2HolderKind = 'team' | 'person';

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

export interface OAuth2Asked {
  readonly teamId: string;
  readonly source: string;
  readonly by: string;
  readonly holder: OAuth2HolderKind;
  readonly back: string | null;
}

export interface OAuth2Authorized extends OAuth2Asked {
  readonly grant: HostGrant;
}

export interface OAuth2LinkingPort {
  begin(asked: OAuth2Asked): Promise<OAuth2Begun | null>;

  authorized(returned: OAuth2Returned): Promise<OAuth2Authorized | null>;

  landingFor(
    teamId: string,
    source: string,
    back: string | null,
  ): Promise<string>;
}
