import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryAlreadyDecidedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string, state: string) {
    super(`Memory ${id} is already ${state}.`);
    this.name = 'MemoryAlreadyDecidedError';
  }
}
