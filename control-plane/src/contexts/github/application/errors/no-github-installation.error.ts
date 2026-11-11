import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class NoGitHubInstallationError extends ApplicationError {
  readonly kind = 'invalid' as const;

  constructor() {
    super(
      'Workspace is not connected to GitHub. Please connect it to access repositories.',
    );
    this.name = 'NoGitHubInstallationError';
  }
}
