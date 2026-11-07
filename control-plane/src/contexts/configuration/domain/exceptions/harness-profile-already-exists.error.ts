import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class HarnessProfileAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`Harness profile ${key} already exists. Please choose another key.`);
    this.name = 'HarnessProfileAlreadyExistsError';
  }
}
