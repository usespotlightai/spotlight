import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownNoticeError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(id: string) {
    super(`Notice ${id} not found.`);
    this.name = 'UnknownNoticeError';
  }
}
