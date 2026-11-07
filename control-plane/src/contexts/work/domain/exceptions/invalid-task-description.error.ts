import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTaskDescriptionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Task description ${reason}.`);
    this.name = 'InvalidTaskDescriptionError';
  }
}
