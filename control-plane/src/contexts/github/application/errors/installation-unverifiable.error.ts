import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class InstallationUnverifiableError extends ApplicationError {
  readonly kind = 'not-allowed' as const;

  constructor() {
    super(
      'GitHub could not confirm this installation is yours. Please sign in again.',
    );
    this.name = 'InstallationUnverifiableError';
  }
}
