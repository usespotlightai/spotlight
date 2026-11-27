import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTaskSearchError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Task search ${reason}.`);
    this.name = 'InvalidTaskSearchError';
  }
}
