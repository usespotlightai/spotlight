import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotAllowedAsOfPastTimeError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(`A run set at a past time cannot ${what}.`);
    this.name = 'NotAllowedAsOfPastTimeError';
  }
}
