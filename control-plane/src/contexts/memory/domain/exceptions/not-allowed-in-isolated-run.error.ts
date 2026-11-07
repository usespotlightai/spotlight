import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotAllowedInIsolatedRunError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(`A run isolated from the team cannot ${what}.`);
    this.name = 'NotAllowedInIsolatedRunError';
  }
}
