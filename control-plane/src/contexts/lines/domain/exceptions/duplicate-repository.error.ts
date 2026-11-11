import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class DuplicateRepositoryError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(name: string) {
    super(
      `Repository ${name} is listed twice. Each repository is cloned into a directory of its own name.`,
    );
    this.name = 'DuplicateRepositoryError';
  }
}
