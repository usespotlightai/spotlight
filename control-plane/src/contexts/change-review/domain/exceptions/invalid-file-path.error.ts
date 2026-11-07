import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidFilePathError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A file path ${reason}.`);
    this.name = 'InvalidFilePathError';
  }
}
