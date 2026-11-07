import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export type ConfigFolderField = 'repository' | 'folder';

export class InvalidConfigFolderError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: ConfigFolderField,
    reason: string,
  ) {
    super(`Config folder ${field} ${reason}.`);
    this.name = 'InvalidConfigFolderError';
  }
}
