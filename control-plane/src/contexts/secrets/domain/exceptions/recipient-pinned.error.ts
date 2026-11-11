import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RecipientPinnedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runId: string, attempt: number) {
    super(
      `Attempt ${attempt} of run ${runId} already fetched its secrets. They are sealed to another recipient.`,
    );
    this.name = 'RecipientPinnedError';
  }
}
