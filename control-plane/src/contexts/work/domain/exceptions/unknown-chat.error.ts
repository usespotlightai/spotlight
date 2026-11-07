import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownChatError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(chatId: string) {
    super(`Chat ${chatId} not found.`);
    this.name = 'UnknownChatError';
  }
}
