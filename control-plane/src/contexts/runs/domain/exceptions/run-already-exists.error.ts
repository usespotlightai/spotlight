import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`A run with id ${id} already exists.`);
    this.name = 'RunAlreadyExistsError';
  }
}
