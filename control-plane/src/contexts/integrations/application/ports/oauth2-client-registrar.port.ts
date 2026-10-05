export const OAUTH2_CLIENT_REGISTRAR = Symbol('OAUTH2_CLIENT_REGISTRAR');

export interface RegisteredClient {
  readonly clientId: string;
  readonly clientSecret: string | null;
  readonly secretExpiresAt: Date | null;
}

export interface OAuth2ClientRegistrarPort {
  register(
    endpoint: string,
    redirectUri: string,
  ): Promise<RegisteredClient | null>;
}
