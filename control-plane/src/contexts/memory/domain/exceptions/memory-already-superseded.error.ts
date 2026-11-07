import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryAlreadySupersededError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Memory ${id} is already superseded by a newer memory. Please reload and try again.`,
    );
    this.name = 'MemoryAlreadySupersededError';
  }
}
