export class OAuth2ClientRegistrationMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(`The ${source} OAuth client was registered by another request`);
    this.name = 'OAuth2ClientRegistrationMovedOnError';
  }
}
