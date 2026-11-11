import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTaskFailureError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Task failure ${reason}.`);
    this.name = 'InvalidTaskFailureError';
  }
}
