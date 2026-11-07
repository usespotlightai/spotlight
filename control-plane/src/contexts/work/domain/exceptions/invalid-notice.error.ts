import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidNoticeError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Notice ${reason}.`);
    this.name = 'InvalidNoticeError';
  }
}
