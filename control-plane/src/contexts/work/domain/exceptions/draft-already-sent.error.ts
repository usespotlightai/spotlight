import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class DraftAlreadySentError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `Someone sent the shared draft of task ${taskId} already. The text you see was not sent.`,
    );
    this.name = 'DraftAlreadySentError';
  }
}
