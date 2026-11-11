import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTaskRevisionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(revision: unknown) {
    super(
      `Task revision must be a whole number from 0. Value: ${String(revision)}`,
    );
    this.name = 'InvalidTaskRevisionError';
  }
}
