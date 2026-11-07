import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownChatHarnessError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(id: string) {
    super(`Harness ${id} not found.`);
    this.name = 'UnknownChatHarnessError';
  }
}
