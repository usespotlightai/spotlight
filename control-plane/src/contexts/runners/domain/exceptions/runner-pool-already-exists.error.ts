import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunnerPoolAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(
      `A runner pool keyed ${key} already exists. Please choose another key.`,
    );
    this.name = 'RunnerPoolAlreadyExistsError';
  }
}
