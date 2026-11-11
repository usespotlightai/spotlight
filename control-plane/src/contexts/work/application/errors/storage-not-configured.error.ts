import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class StorageNotConfiguredError extends ApplicationError {
  readonly kind = 'invalid' as const;

  constructor(stored: string) {
    super(`${stored} storage is not configured on this deployment.`);
    this.name = 'StorageNotConfiguredError';
  }
}
