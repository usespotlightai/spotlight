import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InviteNotPendingError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(why: string) {
    super(`This invite ${why}.`);
    this.name = 'InviteNotPendingError';
  }
}
