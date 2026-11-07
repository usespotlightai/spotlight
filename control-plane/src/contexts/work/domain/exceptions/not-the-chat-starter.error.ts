import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotTheChatStarterError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(chatId: string) {
    super(`Chat ${chatId} not found.`);
    this.name = 'NotTheChatStarterError';
  }
}
