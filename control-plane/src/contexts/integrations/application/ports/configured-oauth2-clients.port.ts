import type { OAuth2Client } from '@integrations/application/ports/oauth2-clients.port';

export const CONFIGURED_OAUTH2_CLIENTS = Symbol('CONFIGURED_OAUTH2_CLIENTS');

export interface ConfiguredOAuth2Client extends OAuth2Client {
  readonly issuer: string | null;
}

export interface ConfiguredOAuth2ClientsPort {
  of(source: string): ConfiguredOAuth2Client | null;
}
