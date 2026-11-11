import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TeamAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`A team with key ${key} already exists. Please choose another key.`);
    this.name = 'TeamAlreadyExistsError';
  }
}
