import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class OAuth2ClientRegistrationVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(
      `Another request registered the ${integration} OAuth client at the same time. Please try again.`,
    );
    this.name = 'OAuth2ClientRegistrationVersionConflictError';
  }
}
