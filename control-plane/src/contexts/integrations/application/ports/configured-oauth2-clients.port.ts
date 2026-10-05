import type { OAuth2Client } from '@integrations/application/ports/oauth2-clients.port';

export const CONFIGURED_OAUTH2_CLIENTS = Symbol('CONFIGURED_OAUTH2_CLIENTS');

export interface ConfiguredOAuth2ClientsPort {
  of(source: string): OAuth2Client | null;
}
