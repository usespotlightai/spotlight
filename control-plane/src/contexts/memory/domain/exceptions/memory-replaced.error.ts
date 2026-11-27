import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryReplacedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Memory ${id} was replaced by a newer memory, so it cannot be restored.`,
    );
    this.name = 'MemoryReplacedError';
  }
}
