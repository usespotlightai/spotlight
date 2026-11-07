import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidJournalEntryError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Journal entry ${reason}.`);
    this.name = 'InvalidJournalEntryError';
  }
}
