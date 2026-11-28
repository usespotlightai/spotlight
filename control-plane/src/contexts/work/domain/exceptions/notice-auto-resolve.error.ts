import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NoticeAutoResolveError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(noticeId: string) {
    super(
      `Notice ${noticeId} resolves itself when its cause ends. A person cannot resolve or reopen it.`,
    );
    this.name = 'NoticeAutoResolveError';
  }
}
