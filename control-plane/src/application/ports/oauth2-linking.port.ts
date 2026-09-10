import type { HostGrant } from '@domain/value-objects/host-grant.vo';

export const OAUTH2_LINKING = Symbol('OAUTH2_LINKING');

/** What a verified callback yields: who linked which host, and what was granted. */
export interface OAuth2Authorized {
  readonly teamId: string;
  readonly source: string;
  readonly by: string;
  readonly grant: HostGrant;
}

/**
 * The OAuth2 protocol, and only that: the URL a person is sent to, and the code
 * they come back with turned into a grant. It neither decides who may link nor
 * writes anything down — the application does both with what this returns, so
 * the deciding and the recording stay where every other aggregate's do.
 */
export interface OAuth2LinkingPort {
  /**
   * The URL to send `by` to, to authorize this team's link to the host, or null
   * where the host is not one that links this way or the deployment has
   * registered no app for it.
   */
  begin(teamId: string, source: string, by: string): Promise<string | null>;

  /**
   * The grant a returning code stands for, with who it was signed for, or null
   * where the state does not hold up or the host refuses.
   */
  authorized(state: string, code: string): Promise<OAuth2Authorized | null>;

  /** The absolute URL to send the browser back to once a host is linked. */
  landingFor(teamId: string, source: string): Promise<string>;
}
