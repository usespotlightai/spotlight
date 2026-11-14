import {
  ApplicationError,
  type ApplicationErrorKind,
} from '@shared-kernel/application/errors/application-error';

export class OAuth2ClientSecretRefusedError extends ApplicationError {
  readonly kind: ApplicationErrorKind;

  constructor(
    readonly secret: string,
    refusal: { readonly message: string; readonly kind: ApplicationErrorKind },
  ) {
    super(refusal.message);
    this.kind = refusal.kind;
    this.name = 'OAuth2ClientSecretRefusedError';
  }
}
