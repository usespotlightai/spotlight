import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidAttachmentError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Attachment ${reason}.`);
    this.name = 'InvalidAttachmentError';
  }
}
