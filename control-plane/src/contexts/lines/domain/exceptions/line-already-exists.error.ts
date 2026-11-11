import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class LineAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`A line with key ${key} already exists in this team.`);
    this.name = 'LineAlreadyExistsError';
  }
}
