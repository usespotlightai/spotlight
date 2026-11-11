import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunnerTrustAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(
      `A runner trust keyed ${key} already exists. Please choose another key.`,
    );
    this.name = 'RunnerTrustAlreadyExistsError';
  }
}
