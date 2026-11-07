import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ConfigFolderUnreachableError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(repository: string) {
    super(
      `The GitHub App can't access ${repository}. Please install it there, or pick another repository.`,
    );
    this.name = 'ConfigFolderUnreachableError';
  }
}
