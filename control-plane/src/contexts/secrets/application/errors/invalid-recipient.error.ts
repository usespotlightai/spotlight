import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class InvalidRecipientError extends ApplicationError {
  readonly kind = 'invalid' as const;

  constructor() {
    super(
      'Recipient is not an X25519 public key. Expected: 32 bytes in base64',
    );
    this.name = 'InvalidRecipientError';
  }
}
