import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTaskTitleError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Task title ${reason}.`);
    this.name = 'InvalidTaskTitleError';
  }
}
