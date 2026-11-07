import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidChatMessageError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Chat message ${reason}.`);
    this.name = 'InvalidChatMessageError';
  }
}
