import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class EgressAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`An egress keyed ${key} already exists. Please choose another key.`);
    this.name = 'EgressAlreadyExistsError';
  }
}
