import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidConversationIdError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(value: string) {
    super(`Conversation id ${value} does not name a task conversation.`);
    this.name = 'InvalidConversationIdError';
  }
}
