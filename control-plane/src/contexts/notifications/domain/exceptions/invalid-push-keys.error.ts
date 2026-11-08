import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidPushKeysError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor() {
    super('The push keys are not valid base64url keys.');
    this.name = 'InvalidPushKeysError';
  }
}
