import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class UnreadableSecretError extends ApplicationError {
  readonly kind = 'upstream-error' as const;

  constructor(secretName: string, because: string) {
    super(`Secret ${secretName} could not be read. ${because}`);
    this.name = 'UnreadableSecretError';
  }
}
