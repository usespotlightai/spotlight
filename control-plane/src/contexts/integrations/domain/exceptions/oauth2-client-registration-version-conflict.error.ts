export class OAuth2ClientRegistrationVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(
      `Another request registered the ${integration} OAuth client at the same time. Please try again.`,
    );
    this.name = 'OAuth2ClientRegistrationVersionConflictError';
  }
}
