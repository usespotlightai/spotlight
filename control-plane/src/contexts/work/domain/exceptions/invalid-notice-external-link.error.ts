import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidNoticeExternalLinkError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Notice external link ${reason}.`);
    this.name = 'InvalidNoticeExternalLinkError';
  }
}
