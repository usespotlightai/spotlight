import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export interface OtherIssuer {
  readonly named: string | null;
  readonly required: string;
}

const messageOf = (integration: string, issuer: OtherIssuer | null) => {
  if (!issuer) {
    return `Integration ${integration} has no OAuth2 client. Required: an OAUTH_CLIENTS entry for ${integration}`;
  }

  const named = issuer.named
    ? `names issuer ${issuer.named}`
    : 'names no issuer';

  return `OAUTH_CLIENTS entry for ${integration} ${named}. Required issuer: ${issuer.required}`;
};

export class OAuth2ClientMissingError extends ApplicationError {
  readonly kind = 'invalid' as const;

  constructor(
    integration: string,
    readonly issuer: OtherIssuer | null = null,
  ) {
    super(messageOf(integration, issuer));
    this.name = 'OAuth2ClientMissingError';
  }
}
