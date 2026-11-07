import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export type ConfigSourceField = 'repository' | 'path';

export class InvalidConfigSourceError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: ConfigSourceField,
    reason: string,
  ) {
    super(`Config source ${field} ${reason}.`);
    this.name = 'InvalidConfigSourceError';
  }
}
