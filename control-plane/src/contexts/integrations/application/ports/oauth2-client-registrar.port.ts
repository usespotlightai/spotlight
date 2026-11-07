import type { OAuth2ClientId } from '@integrations/domain/value-objects/oauth2-client-id.vo';
import type { OAuth2Endpoint } from '@integrations/domain/value-objects/oauth2-endpoint.vo';
export const OAUTH2_CLIENT_REGISTRAR = Symbol('OAUTH2_CLIENT_REGISTRAR');

export interface RegisteredClient {
  readonly clientId: OAuth2ClientId;
  readonly clientSecret: string | null;
  readonly secretExpiresAt: Date | null;
}

export interface OAuth2ClientRegistrarPort {
  register(
    endpoint: OAuth2Endpoint,
    redirectUri: OAuth2Endpoint,
  ): Promise<RegisteredClient | null>;
}
