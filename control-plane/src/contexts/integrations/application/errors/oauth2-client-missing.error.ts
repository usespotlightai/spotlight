import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export interface OtherIssuer {
  readonly named: string | null;
  readonly required: string;
}

export class OAuth2ClientMissingError extends ApplicationError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly integration: string,
    readonly issuer: OtherIssuer | null = null,
  ) {
    super(
      issuer
        ? `Integration ${integration} has no OAuth2 client for its authorization server.`
        : `Integration ${integration} has no OAuth2 client.`,
    );
    this.name = 'OAuth2ClientMissingError';
  }
}
