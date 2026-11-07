import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotAllowedInReplayError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(
      `A replay may not ${what}: it leaves nothing behind but its own result`,
    );
    this.name = 'NotAllowedInReplayError';
  }
}
