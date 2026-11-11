import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InstallationAlreadyConnectedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(installation: string) {
    super(
      `GitHub installation ${installation} is connected to another workspace. Please disconnect it there first.`,
    );
    this.name = 'InstallationAlreadyConnectedError';
  }
}
