import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InstallationAlreadyConnectedError extends DomainError {
  readonly kind = 'conflict' as const;

  // The holder is the name of the workspace that uses the installation, where the caller may see it.
  constructor(holder: string | null = null) {
    super(
      `${holder ?? 'Another workspace'} already uses this GitHub installation. Install the App on another account for this workspace.`,
    );
    this.name = 'InstallationAlreadyConnectedError';
  }
}
