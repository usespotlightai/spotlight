import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class AttachmentHeldElsewhereError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(attachmentIds: readonly string[]) {
    super(
      `Attachment ${attachmentIds.join(', ')} is already attached to another task or chat.`,
    );
    this.name = 'AttachmentHeldElsewhereError';
  }
}
