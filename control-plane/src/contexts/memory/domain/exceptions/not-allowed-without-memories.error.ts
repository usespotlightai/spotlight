import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotAllowedWithoutMemoriesError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(`A run that does not use the team’s memories cannot ${what}.`);
    this.name = 'NotAllowedWithoutMemoriesError';
  }
}
