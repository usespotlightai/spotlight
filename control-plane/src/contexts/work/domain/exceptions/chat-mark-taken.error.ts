import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ChatMarkTakenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(mark: string) {
    super(`Mark ${mark} already finds another chat.`);
    this.name = 'ChatMarkTakenError';
  }
}
