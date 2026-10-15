export class OAuth2ClientRegistrationMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(
      `Another request registered the ${source} OAuth client at the same time. Please try again.`,
    );
    this.name = 'OAuth2ClientRegistrationMovedOnError';
  }
}
