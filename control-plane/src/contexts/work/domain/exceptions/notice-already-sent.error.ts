import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NoticeAlreadySentError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(subject: string) {
    super(`A notice about ${subject} is already sent to this person.`);
    this.name = 'NoticeAlreadySentError';
  }
}
