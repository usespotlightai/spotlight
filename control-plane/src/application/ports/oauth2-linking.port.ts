import type { HostGrant } from '@domain/value-objects/host-grant.vo';

export const OAUTH2_LINKING = Symbol('OAUTH2_LINKING');

export interface OAuth2Authorized {
  readonly teamId: string;
  readonly source: string;
  readonly by: string;
  readonly grant: HostGrant;
}

export interface OAuth2LinkingPort {
  begin(teamId: string, source: string, by: string): Promise<string | null>;

  authorized(state: string, code: string): Promise<OAuth2Authorized | null>;

  landingFor(teamId: string, source: string): Promise<string>;
}
